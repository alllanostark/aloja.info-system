import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

interface PropertyRecord {
  title: string | null;
  address: string | null;
  price_total: number | null;
  num_beds: number | null;
  furnished: boolean;
  url: string;
  platform: 'habitaclia';
  images: string[];
  lat: null;
  lng: null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PLATFORM = 'habitaclia' as const;
const MAX_PAGES = 8;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Remove acentos e normaliza para slug sem espaços */
function toSlug(text: string): string {
  return text
    .split(',')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}

/** Parseia strings de preço tipo "2.060 €" ou "1,500€/mes" → inteiro */
function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extrai número de quartos de strings tipo "2 habitaciones" ou "3 habitaciones" */
function parseBeds(text: string): number | null {
  const m = text.match(/(\d+)\s*habitacion/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

await Actor.init();

const {
  location,
  maxResults = 50,
  minBeds,
  maxPricePerPerson,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" é obrigatório.');
  await Actor.exit({ exitCode: 1 });
}

const slug = toSlug(location);
const startUrl = `https://www.habitaclia.com/alquiler-${slug}.htm`;

// Proxy residencial ES — mais difícil de bloquear que datacenter
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const seen = new Set<string>();
let pushed = 0;
let currentPage = 0;

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,

  async requestHandler({ $, request }) {
    if (pushed >= maxResults) return;

    currentPage++;
    log.info(`[${PLATFORM}] página ${currentPage}: ${request.url}`);

    // ------------------------------------------------------------------
    // Extrai cards
    // Seletor validado contra /tmp/habitaclia.html: article.js-list-item
    // ------------------------------------------------------------------
    const cards = $('article.js-list-item');

    if (cards.length === 0) {
      log.warning(
        `[${PLATFORM}] 0 cards em ${request.url} — seletor pode ter mudado ou proxy foi bloqueado.`,
      );
      return;
    }

    log.info(`[${PLATFORM}] ${cards.length} cards encontrados.`);

    cards.each((_i, el) => {
      if (pushed >= maxResults) return;

      try {
        const card = $(el);

        // ---- Dedup por data-id (atributo validado no HTML) ----
        const dataId = card.attr('data-id') ?? '';
        if (!dataId || seen.has(dataId)) return;
        seen.add(dataId);

        // ---- URL: data-href absoluto (validado no HTML) ----
        const rawHref =
          card.attr('data-href') ??
          card.find('a[href*="alquiler"]').first().attr('href') ??
          '';
        const url = rawHref
          ? new URL(rawHref, 'https://www.habitaclia.com').href
          : (request.loadedUrl ?? request.url);

        // ---- Título: h3.list-item-title > a[itemprop="name"] (validado linha 543) ----
        const title =
          card.find('h3.list-item-title a[itemprop="name"]').first().text().trim() ||
          card.find('h3.list-item-title').first().text().trim() ||
          null;

        // ---- Localização: .list-item-location span (validado linha 545-547) ----
        // Formato real: "Barcelona - Sant Gervasi - Galvany"
        const address =
          card.find('p.list-item-location span').first().text().trim() ||
          card.find('.list-item-location').first().text().trim() ||
          null;

        // ---- Preço: span[itemprop="price"] texto (validado linha 572) ----
        // O HTML usa texto direto "2.060 €", sem atributo content
        const priceRaw =
          card.find('[itemprop="price"]').first().text().trim() ||
          card.find('[itemprop="offers"] [itemprop="price"]').first().text().trim() ||
          null;
        const price_total = parsePrice(priceRaw);

        // ---- Quartos: .list-item-feature texto (validado linha 549) ----
        // Formato: "115m² - 2 habitaciones - 2 baños - 17,91€/m²"
        const featureText = card.find('p.list-item-feature').first().text();
        const num_beds = parseBeds(featureText);

        // ---- Mobilado (validado: titulo linha 543 contém "amueblado") ----
        const cardText = (card.text() + ' ' + (title ?? '')).toLowerCase();
        let furnished = true;
        if (/sin amueblar|sense mobles|sin muebles|no amueblado/i.test(cardText)) {
          furnished = false;
        } else if (/amueblado|moblat|mueblado|amoblado/i.test(cardText)) {
          furnished = true;
        }

        // ---- Imagens: img[src] no card (validado linha 524) ----
        // O HTML usa src direto (sem lazy data-src nesta versão)
        const images = card
          .find('img')
          .map((_j, img) => {
            const src = $(img).attr('data-src') ?? $(img).attr('src') ?? '';
            // Normaliza URLs protocol-relative (//images.habimg.com/...)
            return src.startsWith('//') ? `https:${src}` : src;
          })
          .get()
          .filter((src) => src.startsWith('http') && !src.includes('hab_logos'))
          .slice(0, 6);

        // ---- Filtros de negócio ----
        if (minBeds != null && num_beds != null && num_beds < minBeds) return;
        if (
          maxPricePerPerson != null &&
          price_total != null &&
          num_beds != null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          return;
        }

        const record: PropertyRecord = {
          title,
          address,
          price_total,
          num_beds,
          furnished,
          url,
          platform: PLATFORM,
          images,
          lat: null,
          lng: null,
        };

        void Actor.pushData(record);
        pushed++;
      } catch (err) {
        // Um card malformado nunca para o crawler
        log.warning(`[${PLATFORM}] Erro ao processar card: ${String(err)}`);
      }
    });

    // ------------------------------------------------------------------
    // Paginação
    // Padrão validado contra /tmp/habitaclia.html:
    //   li.next > a  com href  /alquiler-<slug>-N.htm  (índice base-0)
    //   Página 1 = /alquiler-barcelona.htm (sem sufixo numérico)
    //   Página 2 = /alquiler-barcelona-1.htm
    //   Página 3 = /alquiler-barcelona-2.htm
    // ------------------------------------------------------------------
    if (pushed < maxResults && currentPage < MAX_PAGES) {
      const nextHref = $('li.next > a').first().attr('href');
      if (nextHref) {
        const nextUrl = new URL(nextHref, 'https://www.habitaclia.com').href;
        log.info(`[${PLATFORM}] Próxima página: ${nextUrl}`);
        await crawler.addRequests([{ url: nextUrl, label: 'LIST' }]);
      } else {
        log.info(`[${PLATFORM}] Sem próxima página — fim da paginação.`);
      }
    }
  },
});

log.info(`[${PLATFORM}] A iniciar scraping em ${startUrl}`);
await crawler.run([{ url: startUrl, label: 'LIST' }]);
log.info(`[${PLATFORM}] Concluído. ${pushed} imóveis recolhidos.`);

await Actor.exit();
