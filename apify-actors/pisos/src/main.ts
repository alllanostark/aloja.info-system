/**
 * Sparks Aloja - pisos.com scraper
 *
 * Estrategia hibrida: JSON-LD (SingleFamilyResidence) para metadados estruturados
 * (titulo, url, coordenadas, imagem principal) + cards HTML (.ad-preview) para
 * preco e quartos. Cruzamento por indice (ambos em ordem identica na pagina) com
 * fallback por @id / id do div.
 *
 * Paginacao: /alquiler/pisos-{slug}/{page}/ — padrao validado em /tmp/pisos.html
 * linha 6160: <a href="/alquiler/pisos-barcelona/2/">
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

interface PisosListing {
  title: string;
  address: string;
  price_total: number | null;
  num_beds: number | null;
  furnished: boolean;
  url: string;
  platform: 'pisos';
  images: string[];
  lat: number | null;
  lng: number | null;
}

// JSON-LD SingleFamilyResidence shape (campos relevantes)
interface JsonLdItem {
  '@type'?: string;
  '@id'?: string;
  name?: string;
  url?: string;
  image?: string | string[];
  photo?: { contentUrl?: string; url?: string };
  address?: { addressLocality?: string };
  geo?: { latitude?: string | number; longitude?: string | number };
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.pisos.com';
const MAX_PAGES = 8;
const PLATFORM = 'pisos' as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normaliza slug: minusculas, espacos e virgulas -> hifen, remove acentos */
function slugify(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Constroi URL de listagem para uma dada pagina (page >= 1) */
function buildListUrl(slug: string, page: number): string {
  if (page === 1) {
    return `${BASE_URL}/alquiler/pisos-${slug}/`;
  }
  return `${BASE_URL}/alquiler/pisos-${slug}/${page}/`;
}

/** Converte string de preco "1.200 €" ou int em numero inteiro. Null se falhar. */
function parsePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extrai numero de quartos do texto do card. Ex: "2 habs." -> 2 */
function parseBeds(text: string): number | null {
  const m = text.match(/(\d+)\s*hab/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Extrai morada da parte apos " en " no nome do imovel */
function extractAddress(name: string, fallback: string): string {
  const m = name.match(/\sen\s(.+)/i);
  return m ? m[1].trim() : fallback;
}

/** Garante URL absoluta */
function absoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Extrai todos os blocos JSON-LD com @type "SingleFamilyResidence" da pagina.
 * Retorna array na ordem do documento.
 */
function extractJsonLd($: CheerioAPI): JsonLdItem[] {
  const results: JsonLdItem[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html() ?? '';
      const parsed = JSON.parse(raw) as JsonLdItem | JsonLdItem[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item['@type'] === 'SingleFamilyResidence') {
          results.push(item);
        }
      }
    } catch {
      // JSON mal formado — ignorar silenciosamente
    }
  });

  return results;
}

/**
 * Recolhe imagens de um item JSON-LD.
 * Tenta: image (string|array) e photo.contentUrl.
 * Retorna ate 6 URLs unicas.
 */
function extractImages(item: JsonLdItem): string[] {
  const seen = new Set<string>();
  const images: string[] = [];

  const add = (url: string | undefined | null) => {
    if (!url) return;
    const abs = absoluteUrl(url);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      images.push(abs);
    }
  };

  if (Array.isArray(item.image)) {
    item.image.forEach(add);
  } else {
    add(item.image);
  }
  add(item.photo?.contentUrl);

  return images.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Parser principal de uma pagina de listagem
// ---------------------------------------------------------------------------

function parsePage(
  $: CheerioAPI,
  seenIds: Set<string>,
  filters: { minBeds: number; maxPricePerPerson: number },
): PisosListing[] {
  const listings: PisosListing[] = [];

  // 1. Recolhe todos os JSON-LD em ordem de documento
  const jsonLdItems = extractJsonLd($);

  // Mapa auxiliar id -> JsonLdItem para fallback de cruzamento
  const jsonLdById = new Map<string, JsonLdItem>();
  for (const item of jsonLdItems) {
    const id = item['@id'];
    if (id) jsonLdById.set(id, item);
  }

  // 2. Recolhe todos os cards .ad-preview em ordem de documento
  const cards = $('div.ad-preview').toArray();

  // 3. Cruzamento: tenta por indice primeiro; valida com id
  //    Se o id do card (div#id) coincidir com o @id do JSON-LD no mesmo indice -> cruzamento por indice
  //    Caso contrario -> cruzamento por id
  let useCrossById = false;
  if (cards.length > 0 && jsonLdItems.length > 0) {
    const firstCardId = $(cards[0]).attr('id') ?? '';
    const firstJsonId = jsonLdItems[0]['@id'] ?? '';
    // Os ids podem diferir so em formato (div usa "." que e valido em ambos)
    useCrossById = firstCardId !== firstJsonId;
  }

  for (let i = 0; i < cards.length; i++) {
    try {
      const card = $(cards[i]);
      const cardId = card.attr('id') ?? '';

      // Obtem JSON-LD correspondente
      let ldItem: JsonLdItem | undefined;
      if (!useCrossById) {
        ldItem = jsonLdItems[i];
      } else {
        ldItem = jsonLdById.get(cardId);
      }

      // ID para dedup: usa @id do JSON-LD ou id do card
      const itemId = ldItem?.['@id'] ?? cardId;
      if (!itemId || seenIds.has(itemId)) continue;

      // --- Dados do JSON-LD ---
      const name = ldItem?.name ?? '';
      const rawUrl = ldItem?.url ?? card.find('a.ad-preview__title').attr('href') ?? '';
      const url = absoluteUrl(rawUrl);
      const lat = ldItem?.geo?.latitude != null ? parseFloat(String(ldItem.geo.latitude)) : null;
      const lng = ldItem?.geo?.longitude != null ? parseFloat(String(ldItem.geo.longitude)) : null;
      const images = ldItem ? extractImages(ldItem) : [];
      const addressFallback = ldItem?.address?.addressLocality ?? '';
      const address = name ? extractAddress(name, addressFallback) : addressFallback;
      const title = name || card.find('a.ad-preview__title').text().trim();

      // --- Dados do card HTML ---
      // Preco: preferir data-ad-price (int limpo) do .contact-box
      const contactBox = card.find('.contact-box');
      let price_total: number | null = null;
      const dataPriceAttr = contactBox.attr('data-ad-price');
      if (dataPriceAttr) {
        price_total = parsePrice(dataPriceAttr);
      }
      if (price_total === null) {
        // Fallback para texto do .ad-preview__price
        const priceText = card.find('.ad-preview__price').first().text().trim();
        price_total = parsePrice(priceText);
      }

      // Quartos: texto dos .ad-preview__char
      const charTexts = card.find('.ad-preview__char').toArray()
        .map(el => $(el).text().trim())
        .join(' ');
      const num_beds = parseBeds(charTexts);

      // Mobiliado: ausencia de expressoes negativas no texto do card
      const cardText = card.text();
      const furnished = !/sin amueblar|sin muebles/i.test(cardText);

      // --- Filtros ---
      if (num_beds !== null && num_beds < filters.minBeds) continue;
      if (
        price_total !== null &&
        num_beds !== null &&
        num_beds > 0 &&
        price_total / num_beds > filters.maxPricePerPerson
      ) continue;

      // Marca como visto e adiciona
      seenIds.add(itemId);

      listings.push({
        title,
        address,
        price_total,
        num_beds,
        furnished,
        url,
        platform: PLATFORM,
        images,
        lat: lat !== null && !Number.isNaN(lat) ? lat : null,
        lng: lng !== null && !Number.isNaN(lng) ? lng : null,
      });
    } catch (err) {
      // Erro num imovel especifico nao deve parar o scraping
      console.warn(`[pisos] Erro ao processar card ${i}:`, err instanceof Error ? err.message : err);
    }
  }

  return listings;
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
const filters = { minBeds, maxPricePerPerson };

console.log(`[pisos] Iniciando scraping para slug="${slug}", maxResults=${maxResults}, minBeds=${minBeds}, maxPricePerPerson=${maxPricePerPerson}`);

// Proxy residencial ES
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const seenIds = new Set<string>();
let totalCollected = 0;
let pagesProcessed = 0;

// Pre-gera URLs ate MAX_PAGES (sera interrompido se maxResults atingido)
const startUrls = Array.from({ length: MAX_PAGES }, (_, i) => ({
  url: buildListUrl(slug, i + 1),
  label: `page_${i + 1}`,
}));

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestsPerCrawl: MAX_PAGES,
  // pisos.com nao tem anti-bot relevante, headers minimos sao suficientes
  additionalMimeTypes: ['text/html'],

  async requestHandler({ $, request, crawler: c }) {
    if (totalCollected >= maxResults) return;

    pagesProcessed++;
    console.log(`[pisos] Processando pagina ${pagesProcessed}: ${request.url}`);

    const pageListings = parsePage($, seenIds, filters);

    for (const listing of pageListings) {
      if (totalCollected >= maxResults) break;
      await Actor.pushData(listing);
      totalCollected++;
    }

    console.log(`[pisos] Pagina ${pagesProcessed}: ${pageListings.length} encontrados, ${totalCollected}/${maxResults} total`);

    // Se chegamos ao limite, para o crawler
    if (totalCollected >= maxResults) {
      console.log('[pisos] Limite de resultados atingido. A parar.');
      await c.teardown();
    }
  },

  failedRequestHandler({ request, error }) {
    console.error(`[pisos] Falha definitiva em ${request.url}:`, error instanceof Error ? error.message : error);
  },
});

await crawler.run(startUrls.map(r => r.url));

console.log(`[pisos] Concluido. ${totalCollected} imoveis recolhidos em ${pagesProcessed} paginas.`);

await Actor.exit();
