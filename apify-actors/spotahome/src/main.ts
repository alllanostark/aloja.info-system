import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';
import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

// ---------------------------------------------------------------------------
// JSON-LD SearchResultsPage
// ---------------------------------------------------------------------------
interface LdAboutItem {
  url?: string;
  name?: string;
  image?: string;
  address?: {
    streetAddress?: string;
    postalCode?: string;
  };
}

interface LdSearchResultsPage {
  '@type'?: string;
  about?: LdAboutItem[];
}

// ---------------------------------------------------------------------------
// Output shape — nomes EXACTOS consumidos pelo servidor
// ---------------------------------------------------------------------------
interface PropertyRecord {
  title: string | null;
  address: string | null;
  price_total: number | null;
  num_beds: number;
  furnished: true;
  url: string;
  platform: 'spotahome';
  images: string[];
  lat: null;
  lng: null;
}

const PLATFORM = 'spotahome' as const;
const BASE = 'https://www.spotahome.com';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toInt(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function decodeEntities(str: string): string {
  // Cheerio .text() já decodifica entidades mas por segurança
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/**
 * Normaliza a cidade para o slug do Spotahome.
 * "Sant Adrià de Besòs, Barcelona" → "sant-adria-de-besos"
 */
function toSlug(location: string): string {
  return location
    .split(',')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}

function buildUrl(slug: string, page: number): string {
  const base = `${BASE}/s/${slug}--spain`;
  return page === 1 ? base : `${base}?page=${page}`;
}

/**
 * Infere num_beds:
 *  - Room (quarto individual numa flat partilhada) → 1
 *  - "4-bedroom apartment" → 4
 *  - Studio / sem regex → 1
 */
function inferBeds(propType: string, title: string): number {
  const t = propType.toLowerCase();
  if (t === 'room') return 1;
  if (t === 'studio') return 1;

  const m = title.match(/(\d+)\s*-?\s*bedroom/i);
  if (m) return parseInt(m[1], 10);

  return 1;
}

/**
 * Extrai o mapa { relativeUrl → LdAboutItem } do JSON-LD SearchResultsPage.
 * Retorna {} se não existir ou falhar o parse.
 */
function extractLdMap($: cheerio.CheerioAPI): Map<string, LdAboutItem> {
  const map = new Map<string, LdAboutItem>();
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).text();
      const obj = JSON.parse(raw) as LdSearchResultsPage;
      if (obj['@type'] === 'SearchResultsPage' && Array.isArray(obj.about)) {
        for (const item of obj.about) {
          if (item.url) map.set(item.url, item);
        }
      }
    } catch {
      // bloco JSON-LD inválido — ignorar
    }
  });
  return map;
}

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------
await Actor.init();

const {
  location,
  maxResults = 50,
  minBeds = 1,
  maxPricePerPerson = 700,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" é obrigatório.');
  await Actor.exit();
  process.exit(1);
}

const slug = toSlug(location);
log.info(`Spotahome: slug="${slug}", maxResults=${maxResults}, minBeds=${minBeds}, maxPricePerPerson=${maxPricePerPerson}`);

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const seen = new Set<string>(); // dedup por card ID
let pushed = 0;
let currentPage = 1;
// Teto de páginas: evita paginação infinita quando o filtro de budget descarta
// tudo (pushed nunca atinge maxResults mas cada página continua a ter cards).
// 8 páginas × ~48 cards ≈ 384 imóveis brutos — mais que suficiente.
const MAX_PAGES = 8;

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,
  maxConcurrency: 1, // paginação sequencial para controlo de pushed

  async requestHandler({ $, request }) {
    if (pushed >= maxResults) return;

    const pageNum = (request.userData['page'] as number) ?? 1;
    log.info(`Spotahome: a processar página ${pageNum} (${request.url})`);

    // ------------------------------------------------------------------
    // JSON-LD — enriquecimento de título, endereço e imagem (10 items)
    // ------------------------------------------------------------------
    const ldMap = extractLdMap($);
    log.debug(`Spotahome: JSON-LD com ${ldMap.size} items encontrado.`);

    // ------------------------------------------------------------------
    // Cards
    // ------------------------------------------------------------------
    const cards = $('[data-homecard-scroll]');
    log.info(`Spotahome: ${cards.length} cards na página ${pageNum}.`);

    if (cards.length === 0) {
      log.info(`Spotahome: sem cards na página ${pageNum} — fim de paginação.`);
      return;
    }

    for (let i = 0; i < cards.length; i++) {
      if (pushed >= maxResults) break;

      const card = cards.eq(i);

      try {
        // ---------------------------------------------------------------
        // ID e dedup
        // ---------------------------------------------------------------
        const cardId = card.attr('data-homecard-scroll') ?? '';
        if (!cardId || seen.has(cardId)) continue;
        seen.add(cardId);

        // ---------------------------------------------------------------
        // href → url absoluta
        // ---------------------------------------------------------------
        const relHref = card.find('a[href*="/for-rent"]').first().attr('href') ?? '';
        if (!relHref) {
          log.warning(`Spotahome: card ${cardId} sem href — ignorado.`);
          continue;
        }
        const url = relHref.startsWith('http') ? relHref : `${BASE}${relHref}`;

        // ---------------------------------------------------------------
        // Tipo de propriedade
        // ---------------------------------------------------------------
        const propType = card.find('[class*="homecard-content__type"]').first().text().trim() || 'Room';

        // ---------------------------------------------------------------
        // Título — preferir JSON-LD (mais limpo), fallback homecard-content__title
        // ---------------------------------------------------------------
        const ldItem = ldMap.get(relHref);
        let title: string | null =
          ldItem?.name
            ? decodeEntities(ldItem.name)
            : decodeEntities(card.find('[class*="homecard-content__title"]').first().text().trim()) || null;

        // ---------------------------------------------------------------
        // Preço — class*="price__amount" → "609 €" → regex
        // Validado: 48/48 cards têm este elemento
        // ---------------------------------------------------------------
        const priceRaw = card.find('[class*="price__amount"]').first().text().trim();
        const priceMatch = priceRaw.match(/([\d.,]+)/);
        const price_total = priceMatch ? toInt(priceMatch[1]) : null;

        // ---------------------------------------------------------------
        // num_beds — tipo + título
        // ---------------------------------------------------------------
        const num_beds = inferBeds(propType, title ?? '');

        // ---------------------------------------------------------------
        // Endereço — JSON-LD (streetAddress + postalCode) para os 10 primeiros
        // Para os restantes: extrair do título (contém zona/cidade)
        // ---------------------------------------------------------------
        let address: string | null = null;
        if (ldItem?.address) {
          const parts = [ldItem.address.streetAddress, ldItem.address.postalCode].filter(Boolean);
          address = parts.join(', ') || null;
        } else if (title) {
          // O título contém o bairro/cidade: "Room in shared flat in La Dreta de l'Eixample, Barcelona"
          // Extraímos tudo a partir de "in <zona>" ou da última vírgula
          const inMatch = title.match(/\bin\s+(.+)$/i);
          address = inMatch ? inMatch[1].trim() : null;
        }

        // ---------------------------------------------------------------
        // Imagens — JSON-LD tem 1 imagem para os 10 primeiros
        // Restantes: img[src*="photos.spotahome.com"] no card (lazy load → geralmente vazio)
        // ---------------------------------------------------------------
        const images: string[] = [];
        if (ldItem?.image) {
          images.push(ldItem.image);
        }
        // Adicionar imgs do carousel se existirem (primeiros 3 cards no HTML estático)
        card.find('img[src*="photos.spotahome.com"]').each((_j, img) => {
          const src = $(img).attr('src');
          if (src && !images.includes(src)) images.push(src);
        });
        // Remover duplicados e limitar a 6
        const uniqueImages = [...new Set(images)].slice(0, 6);

        // ---------------------------------------------------------------
        // Filtros de negócio
        // ---------------------------------------------------------------
        if (num_beds < minBeds) {
          log.debug(`Spotahome: card ${cardId} descartado (num_beds=${num_beds} < minBeds=${minBeds})`);
          continue;
        }
        if (price_total !== null && price_total / num_beds > maxPricePerPerson) {
          log.debug(
            `Spotahome: card ${cardId} descartado (${price_total}/${num_beds}=${(price_total / num_beds).toFixed(0)} > maxPricePerPerson=${maxPricePerPerson})`,
          );
          continue;
        }

        // ---------------------------------------------------------------
        // Push
        // ---------------------------------------------------------------
        const record: PropertyRecord = {
          title,
          address,
          price_total,
          num_beds,
          furnished: true,
          url,
          platform: PLATFORM,
          images: uniqueImages,
          lat: null,
          lng: null,
        };

        await Actor.pushData(record);
        pushed++;
        log.info(`Spotahome: imóvel #${pushed} guardado — ${title ?? url} (${price_total}€, ${num_beds}q)`);
      } catch (err) {
        log.warning(`Spotahome: erro ao processar card — ${String(err)}`);
        // continua para o próximo card
      }
    }

    // ------------------------------------------------------------------
    // Paginação: enfileira próxima página se ainda há resultados a recolher
    // ------------------------------------------------------------------
    if (pushed < maxResults && cards.length > 0 && currentPage < MAX_PAGES) {
      currentPage++;
      const nextUrl = buildUrl(slug, currentPage);
      await crawler.addRequests([
        {
          url: nextUrl,
          userData: { page: currentPage },
        },
      ]);
      log.info(`Spotahome: a enfileirar página ${currentPage} — ${nextUrl}`);
    }
  },
});

// Arrancar com a página 1
await crawler.run([
  {
    url: buildUrl(slug, 1),
    userData: { page: 1 },
  },
]);

log.info(`Spotahome: scraping concluído. ${pushed} imóveis recolhidos.`);
await Actor.exit();
