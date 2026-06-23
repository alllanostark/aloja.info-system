/**
 * Sparks Aloja - yaencontre.com scraper
 *
 * AVISO ANTI-BOT: yaencontre usa DataDome. Este actor usa CheerioCrawler
 * com proxy RESIDENTIAL (countryCode ES). Se a nuvem Apify for bloqueada,
 * o requestHandler deteta o bloqueio, loga um aviso e para graciosamente
 * sem rebentar o run (nao e um erro do codigo).
 *
 * Seletores validados ao vivo no browser:
 * - Cards: article com a[href*="/alquiler/"] + preco "€/mes"
 * - Preco: regex /(\d[\d.,]*)\s*€\s*\/\s*mes/i no texto do card
 * - Quartos: regex /(\d+)\s*hab/i no texto do card
 * - Titulo: .title-wrapper (fallback: primeiro h2/h3/a)
 * - Imagens: img[src|data-src] com dominio media.yaencontre.com
 * - Paginacao: ?pagina=N (pagina 1 sem param)
 * - ID dedup: extraido do href (ex: "/alquiler/piso/inmueble-56123-111824845" -> "56123-111824845")
 */

import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';
import type { CheerioAPI } from 'cheerio';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

interface YaencontreListing {
  title: string;
  address: string;
  price_total: number | null;
  num_beds: number | null;
  furnished: boolean;
  url: string;
  platform: 'yaencontre';
  images: string[];
  lat: null;
  lng: null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.yaencontre.com';
const MAX_PAGES = 8;
const PLATFORM = 'yaencontre' as const;

// Tamanho minimo de body considerado valido (< 5000 chars = bloqueio DataDome)
const MIN_BODY_SIZE = 5000;

// Termos que indicam pagina de bloqueio DataDome
const BLOCK_SIGNALS = ['captcha', 'datadome', 'geo.captcha'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normaliza slug: minusculas, remove acentos, espacos e virgulas para '-',
 * remove chars que nao sejam a-z0-9 ou hifen.
 * Ex: "Barcelona, Eixample" -> "barcelona-eixample"
 */
function slugify(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Constroi URL de listagem para uma dada pagina.
 * Pagina 1 nao tem parametro; paginas seguintes usam ?pagina=N.
 */
function buildListUrl(slug: string, page: number): string {
  const base = `${BASE_URL}/alquiler/pisos/${slug}`;
  if (page === 1) return base;
  return `${base}?pagina=${page}`;
}

/**
 * Extrai o ID de dedup do href de um card yaencontre.
 * Ex: "/alquiler/piso/inmueble-56123-111824845" -> "56123-111824845"
 * Fallback: usa o href completo.
 */
function extractIdFromHref(href: string): string {
  // Tenta apanhar a parte numerica apos "inmueble-" (ou qualquer prefixo)
  const m = href.match(/inmueble-([0-9]+-[0-9]+)/i);
  if (m) return m[1];
  // Fallback: usa o segmento final do path
  const segments = href.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? href;
}

/**
 * Converte string de preco "1.400 €/mes" em numero inteiro (1400).
 * Remove pontos de milhar. Retorna null se falhar.
 */
function parsePrice(raw: string): number | null {
  const m = raw.match(/(\d[\d.,]*)\s*€\s*\/\s*mes/i);
  if (!m) return null;
  // Remove pontos de milhar e converte virgula decimal em ponto
  const clean = m[1].replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Extrai numero de quartos do texto do card. Ex: "3 hab." -> 3 */
function parseBeds(text: string): number | null {
  const m = text.match(/(\d+)\s*hab/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Extrai morada da parte apos " en " no titulo. Senao devolve o titulo. */
function extractAddress(title: string): string {
  const m = title.match(/\sen\s(.+)/i);
  return m ? m[1].trim() : title;
}

/** Garante URL absoluta. Normaliza "//..." -> "https://...". */
function absoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Deteta se a resposta e uma pagina de bloqueio DataDome.
 * Criterio: body pequeno (< MIN_BODY_SIZE chars) OU contem termos de bloqueio.
 */
function isBlocked(body: string): boolean {
  if (body.length < MIN_BODY_SIZE) return true;
  const lower = body.toLowerCase();
  return BLOCK_SIGNALS.some(signal => lower.includes(signal));
}

// ---------------------------------------------------------------------------
// Parser principal de uma pagina de listagem
// ---------------------------------------------------------------------------

interface ParseResult {
  listings: YaencontreListing[];
  hasCards: boolean;
}

function parsePage(
  $: CheerioAPI,
  seenIds: Set<string>,
  filters: { minBeds: number; maxPricePerPerson: number },
  applyFilters: boolean,
): ParseResult {
  const listings: YaencontreListing[] = [];

  // Seleciona todos os <article> da pagina
  const allArticles = $('article').toArray();

  // Filtra apenas os cards validos: tem link /alquiler/ E texto com "€/mes"
  const cards = allArticles.filter(el => {
    const article = $(el);
    const hasAlquilerLink = article.find('a[href*="/alquiler/"]').length > 0;
    const hasPrice = /€\s*\/\s*mes/i.test(article.text());
    return hasAlquilerLink && hasPrice;
  });

  const hasCards = cards.length > 0;

  for (let i = 0; i < cards.length; i++) {
    try {
      const card = $(cards[i]);
      const cardText = card.text();

      // --- URL e ID ---
      const linkEl = card.find('a[href*="/alquiler/"]').first();
      const rawHref = linkEl.attr('href') ?? '';
      if (!rawHref) continue;

      const itemId = extractIdFromHref(rawHref);
      if (!itemId || seenIds.has(itemId)) continue;

      const url = absoluteUrl(rawHref);

      // --- Preco ---
      const price_total = parsePrice(cardText);

      // --- Quartos ---
      const num_beds = parseBeds(cardText);

      // --- Titulo ---
      let title = card.find('.title-wrapper').first().text().trim();
      if (!title) {
        // Fallback: h2, h3 ou texto do link principal
        title =
          card.find('h2').first().text().trim() ||
          card.find('h3').first().text().trim() ||
          linkEl.text().trim();
      }
      title = title || rawHref;
      // O .title-wrapper às vezes cola o preço ao título ("...Barcelona1.400 €/mes").
      // Corta no primeiro padrão de preço para não poluir o título nem o address
      // (que é usado para geocoding no servidor).
      title = title.split(/\s*\d[\d.,]*\s*€/)[0].trim();

      // --- Morada ---
      const address = extractAddress(title);

      // --- Imagens ---
      const images: string[] = [];
      const seenImgs = new Set<string>();

      card.find('img').each((_idx, imgEl) => {
        // Tenta src primeiro, depois data-src (lazy load)
        const src =
          $(imgEl).attr('src') ||
          $(imgEl).attr('data-src') ||
          '';
        if (!src) return;
        const abs = absoluteUrl(src);
        if (abs && abs.startsWith('http') && !seenImgs.has(abs)) {
          seenImgs.add(abs);
          images.push(abs);
        }
      });

      // --- Mobiliado ---
      // Expressoes negativas indicam sem mobilia; por defeito assume mobilado
      const furnished = !/sin amueblar|sin muebles/i.test(cardText);

      // --- Filtros opcionais ---
      if (applyFilters) {
        if (num_beds !== null && num_beds < filters.minBeds) continue;
        if (
          price_total !== null &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > filters.maxPricePerPerson
        ) continue;
      }

      // Marca como visto
      seenIds.add(itemId);

      listings.push({
        title,
        address,
        price_total,
        num_beds,
        furnished,
        url,
        platform: PLATFORM,
        images: images.slice(0, 6),
        lat: null,
        lng: null,
      });
    } catch (err) {
      console.warn(
        `[yaencontre] Erro ao processar card ${i}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { listings, hasCards };
}

// ---------------------------------------------------------------------------
// Actor principal
// ---------------------------------------------------------------------------

await Actor.init();

const input = (await Actor.getInput<Input>()) ?? ({ location: 'barcelona' } as Input);

const {
  location,
  maxResults = 25,
  minBeds = 1,
  maxPricePerPerson = 450,
} = input;

if (!location) {
  throw new Error('Input "location" e obrigatorio.');
}

const slug = slugify(location);
// Aplica filtros de quartos/preco apenas quando definidos pelo utilizador
// (os defaults 1 / 450 sao conservadores mas evitam filtrar demasiado)
const applyFilters = minBeds > 1 || maxPricePerPerson < 9999;
const filters = { minBeds, maxPricePerPerson };

console.log(
  `[yaencontre] Iniciando scraping para slug="${slug}", maxResults=${maxResults}` +
  `, minBeds=${minBeds}, maxPricePerPerson=${maxPricePerPerson}` +
  `, applyFilters=${applyFilters}`,
);
console.log('[yaencontre] AVISO: site usa DataDome — proxy RESIDENTIAL ES activo.');

// Proxy residencial ES para tentar contornar DataDome
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const seenIds = new Set<string>();
let totalCollected = 0;
let pagesProcessed = 0;
let blockedCount = 0;

// Pre-gera URLs ate MAX_PAGES
const startUrls = Array.from({ length: MAX_PAGES }, (_, i) => buildListUrl(slug, i + 1));

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestsPerCrawl: MAX_PAGES,
  additionalMimeTypes: ['text/html'],

  async requestHandler({ $, request, body, crawler: c }) {
    if (totalCollected >= maxResults) return;

    const bodyStr = typeof body === 'string' ? body : body.toString('utf-8');

    // Detecao de bloqueio DataDome
    if (isBlocked(bodyStr)) {
      blockedCount++;
      console.warn(
        `[yaencontre] BLOQUEADO por DataDome na pagina ${pagesProcessed + 1} (${request.url})` +
        ' — proxy residencial nao passou. Parando.',
      );
      await c.teardown();
      return;
    }

    pagesProcessed++;
    console.log(`[yaencontre] Processando pagina ${pagesProcessed}: ${request.url}`);

    const { listings, hasCards } = parsePage($, seenIds, filters, applyFilters);

    // Se nao ha cards validos nesta pagina, nao ha mais resultados
    if (!hasCards) {
      console.log(`[yaencontre] Pagina ${pagesProcessed} sem cards validos. Parando paginacao.`);
      await c.teardown();
      return;
    }

    for (const listing of listings) {
      if (totalCollected >= maxResults) break;
      await Actor.pushData(listing);
      totalCollected++;
    }

    console.log(
      `[yaencontre] Pagina ${pagesProcessed}: ${listings.length} encontrados,` +
      ` ${totalCollected}/${maxResults} total`,
    );

    if (totalCollected >= maxResults) {
      console.log('[yaencontre] Limite de resultados atingido. A parar.');
      await c.teardown();
    }
  },

  failedRequestHandler({ request, error }) {
    console.error(
      `[yaencontre] Falha definitiva em ${request.url}:`,
      error instanceof Error ? error.message : error,
    );
  },
});

await crawler.run(startUrls);

if (blockedCount > 0) {
  console.warn(
    `[yaencontre] Run terminado com ${blockedCount} bloqueio(s) DataDome.` +
    ' Resultado parcial ou vazio esperado.',
  );
} else {
  console.log(
    `[yaencontre] Concluido. ${totalCollected} imoveis recolhidos em ${pagesProcessed} paginas.`,
  );
}

await Actor.exit();
