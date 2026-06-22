import { Actor } from 'apify';
import { CheerioCrawler, log, RequestQueue } from 'crawlee';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

interface PhotoItem {
  hash: string;
  placeholder: boolean;
}

interface OfferPrice {
  amount: number;       // em CÊNTIMOS (ex: 139000 = 1390 EUR)
  currency_code: string;
}

interface Neighbourhood {
  name: string;
}

interface Property {
  id: number;
  number_of_rooms: number | null;
  coordinates: [number, number] | null; // [latitude, longitude]
  neighbourhood: Neighbourhood | null;
  photos: PhotoItem[];
  type: string;
  accommodation_type: string;
}

interface AccommodationOffer {
  title: string;
  price: OfferPrice;
}

interface OfferAttributes {
  accommodation_offer: AccommodationOffer;
  property: Property;
  photos: PhotoItem[];
}

interface Offer {
  id: string | number;
  type: string;
  attributes: OfferAttributes;
}

interface PageProps {
  offers: {
    data: Offer[];
    meta: {
      total_page_number: number;
    };
  };
}

interface NextData {
  props: {
    pageProps: PageProps;
  };
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PLATFORM = 'uniplaces';
const MAX_PAGES = 8;
const PHOTO_BASE = 'https://cdn-static-new.uniplaces.com/property-photos';
const PHOTO_SIZE = 'large'; // 200 OK confirmado: small | medium | large | original

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toFloat = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const normalizeSlug = (location: string): string =>
  location
    .split(',')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');

const buildUrl = (slug: string, page: number): string =>
  page === 1
    ? `https://www.uniplaces.com/en/accommodation/${slug}`
    : `https://www.uniplaces.com/en/accommodation/${slug}?page=${page}`;

const buildPhotoUrls = (photos: PhotoItem[]): string[] =>
  photos
    .filter((p) => !p.placeholder && p.hash)
    .map((p) => `${PHOTO_BASE}/${p.hash}/${PHOTO_SIZE}.jpg`)
    .slice(0, 6);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

await Actor.init();

const {
  location,
  maxResults = 100,
  minBeds,
  maxPricePerPerson,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" é obrigatório.');
  await Actor.exit();
  process.exit(1); // satisfaz TypeScript — exit() já termina
}

const slug = normalizeSlug(location);
const cityLabel = slug.charAt(0).toUpperCase() + slug.slice(1);

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

let pushed = 0;
const seenIds = new Set<string>();

const requestQueue = await RequestQueue.open();
await requestQueue.addRequest({ url: buildUrl(slug, 1), userData: { page: 1 } });

const crawler = new CheerioCrawler({
  proxyConfiguration,
  requestQueue,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,

  async requestHandler({ body, request }) {
    if (pushed >= maxResults) return;

    const currentPage: number = request.userData.page as number;

    // -----------------------------------------------------------------------
    // 1. Extrair __NEXT_DATA__ do body bruto (evita conflitos de tipos Cheerio)
    // -----------------------------------------------------------------------
    const html = body.toString();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

    if (!m) {
      log.warning(`[Uniplaces] __NEXT_DATA__ não encontrado em ${request.url} — página possivelmente bloqueada.`);
      return;
    }

    let nextData: NextData;
    try {
      nextData = JSON.parse(m[1]) as NextData;
    } catch (err) {
      log.warning(`[Uniplaces] Falha ao fazer parse do __NEXT_DATA__: ${String(err)}`);
      return;
    }

    const offersArr: Offer[] = nextData?.props?.pageProps?.offers?.data ?? [];

    if (offersArr.length === 0) {
      log.info(`[Uniplaces] Página ${currentPage} sem resultados — paginação termina.`);
      return;
    }

    log.info(`[Uniplaces] Página ${currentPage}: ${offersArr.length} imóveis encontrados.`);

    // -----------------------------------------------------------------------
    // 2. Processar cada imóvel
    // -----------------------------------------------------------------------
    for (const o of offersArr) {
      if (pushed >= maxResults) break;

      try {
        const id = String(o.id);

        // Dedup
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const attrs = o.attributes;
        const ao = attrs.accommodation_offer;
        const prop = attrs.property;

        // Preço — amount está em CÊNTIMOS
        const priceObj = ao?.price;
        if (!priceObj || priceObj.currency_code !== 'EUR') continue;
        const price_total = Math.round(priceObj.amount / 100);
        if (price_total <= 0) continue;

        // Título
        const title: string = ao.title ?? '';

        // Quartos — o título é mais fiável que property.number_of_rooms, que no
        // Uniplaces reflete o total de quartos da RESIDÊNCIA (ex: 238 num studio).
        const bedroomMatch = title.match(/(\d+)\s*-?\s*bedroom/i);
        let num_beds: number | null;
        if (bedroomMatch) {
          num_beds = parseInt(bedroomMatch[1], 10);
        } else if (/\bstudio\b/i.test(title)) {
          num_beds = 1;
        } else if (/\b(bedroom|room|bed)\b/i.test(title)) {
          num_beds = 1; // quarto individual partilhado
        } else if (
          typeof prop?.number_of_rooms === 'number' &&
          prop.number_of_rooms > 0 &&
          prop.number_of_rooms <= 15
        ) {
          num_beds = prop.number_of_rooms;
        } else {
          num_beds = null;
        }

        // Filtro: número de camas
        if (minBeds !== undefined && num_beds !== null && num_beds < minBeds) continue;

        // Filtro: preço por pessoa
        if (
          maxPricePerPerson !== undefined &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) continue;

        // Coordenadas — coordinates é [latitude, longitude]
        const coords = prop?.coordinates;
        const lat: number | null = Array.isArray(coords) ? toFloat(coords[0]) : null;
        const lng: number | null = Array.isArray(coords) ? toFloat(coords[1]) : null;

        // Morada — neighbourhood.name + cidade
        const neighbourhoodName: string = prop?.neighbourhood?.name ?? '';
        const address: string = neighbourhoodName
          ? `${neighbourhoodName}, ${cityLabel}`
          : cityLabel;

        // URL — https://www.uniplaces.com/en/accommodation/<slug>/<offer_id>
        const url = `https://www.uniplaces.com/en/accommodation/${slug}/${id}`;

        // Imagens — usa a.photos (mais completo que prop.photos)
        // Filtra placeholder:false e constrói URL via CDN
        const photosArr: PhotoItem[] = attrs.photos ?? prop?.photos ?? [];
        const images = buildPhotoUrls(photosArr);

        await Actor.pushData({
          title,
          address,
          price_total,
          num_beds,
          furnished: true, // Uniplaces é mobilado por definição
          url,
          platform: PLATFORM,
          images,
          lat,
          lng,
        });

        pushed++;
        log.debug(`[Uniplaces] #${pushed} adicionado — ${title} (${price_total}€)`);
      } catch (err) {
        log.warning(`[Uniplaces] Item malformado ignorado: ${String(err)}`);
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Paginação — enquanto houver resultados e não atingir MAX_PAGES
    // -----------------------------------------------------------------------
    if (pushed < maxResults && offersArr.length > 0 && currentPage < MAX_PAGES) {
      const nextPage = currentPage + 1;
      await requestQueue
        .addRequest({
          url: buildUrl(slug, nextPage),
          userData: { page: nextPage },
        })
        .catch(() => {
          // Ignora duplicados na fila
        });
    }
  },
});

await crawler.run();
log.info(`[Uniplaces] Scraping concluído. ${pushed} imóveis recolhidos.`);
await Actor.exit();
