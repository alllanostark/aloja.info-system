import { Actor } from 'apify';
import { CheerioCrawler, log, RequestQueue } from 'crawlee';

// ---------------------------------------------------------------------------
// Tipos mínimos do JSON embebido em __initial_props__
// ---------------------------------------------------------------------------

interface FcFeature {
  key: string;
  value: number;
  maxValue: number;
  minValue: number;
}

interface FcMultimedia {
  type: string;
  src: string;
  roomType: string;
}

interface FcAddress {
  neighborhood?: string;
  district?: string;
  municipality?: string;
  province?: string;
  zipCode?: string;
  country?: string;
}

interface FcCoordinates {
  latitude: number;
  longitude: number;
}

interface FcRealEstate {
  realEstateAdId?: string;
  id?: string | number;
  rawPrice?: number;
  price?: string;
  features?: FcFeature[];
  coordinates?: FcCoordinates;
  address?: FcAddress;
  detail?: Record<string, string>;
  detailWithParams?: Record<string, string>;
  multimedia?: FcMultimedia[];
  buildingType?: string;
}

interface FcData {
  initialSearch?: {
    result?: {
      realEstates?: FcRealEstate[];
    };
  };
}

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
// Constantes
// ---------------------------------------------------------------------------

const PLATFORM = 'fotocasa';
const MAX_PAGES = 8;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

await Actor.init();

const {
  location,
  maxResults = 25,
  minBeds = 1,
  maxPricePerPerson = 450,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" é obrigatório.');
  await Actor.exit();
}

// Normaliza o slug a partir da primeira parte do endereço (antes da vírgula).
// NOTA: para cidades com slug composto (ex: "Barcelona" → "barcelona-capital"),
// o chamador deve passar o slug correto como location. A normalização simples
// cobre cidades de uma palavra (Tarragona, Terrassa, Girona, etc.).
// Trataremos o mapeamento barcelona→barcelona-capital no app antes de invocar o actor.
const slug = location
  .split(',')[0]
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '') // remove diacríticos
  .replace(/\s+/g, '-');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildUrl = (citySlug: string, page: number): string =>
  page === 1
    ? `https://www.fotocasa.es/es/alquiler/viviendas/${citySlug}/todas-las-zonas/l`
    : `https://www.fotocasa.es/es/alquiler/viviendas/${citySlug}/todas-las-zonas/l/_pagina-${page}`;

const buildAddress = (addr?: FcAddress): string => {
  if (!addr) return '';
  const parts = [addr.neighborhood, addr.district, addr.municipality].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : (addr.municipality ?? '');
};

const buildTitle = (re: FcRealEstate): string => {
  const typeMap: Record<string, string> = {
    Flat: 'Piso',
    House: 'Casa',
    Studio: 'Estúdio',
    Duplex: 'Duplex',
    Penthouse: 'Ático',
  };
  const tipo = typeMap[re.buildingType ?? ''] ?? re.buildingType ?? 'Imóvel';
  const zona =
    re.address?.neighborhood ??
    re.address?.district ??
    re.address?.municipality ??
    '';
  return zona ? `${tipo} em ${zona}` : tipo;
};

// ---------------------------------------------------------------------------
// Proxy + queue
// ---------------------------------------------------------------------------

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const requestQueue = await RequestQueue.open();
await requestQueue.addRequest({ url: buildUrl(slug, 1), userData: { page: 1, citySlug: slug } });

// Set de dedup por id do anúncio
const seen = new Set<string>();
let pushed = 0;

// ---------------------------------------------------------------------------
// CheerioCrawler — sem browser, sem Playwright
// Os dados estão inteiramente no JSON embebido em <script id="__initial_props__">
// Usamos `body` bruto (Buffer→string) + regex para evitar o conflito de tipos
// do cheerio CJS/ESM ao tentar parsear via $('script').text().
// ---------------------------------------------------------------------------

const crawler = new CheerioCrawler({
  proxyConfiguration,
  requestQueue,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,

  async requestHandler({ request, body }) {
    if (pushed >= maxResults) return;

    const currentPage: number = request.userData.page ?? 1;
    const citySlug: string = request.userData.citySlug ?? slug;

    // Extrai JSON via regex no HTML bruto — evita conflito de tipos cheerio CJS/ESM
    const html = body.toString();
    const match = html.match(
      /<script[^>]*id="__initial_props__"[^>]*>([\s\S]*?)<\/script>/,
    );

    if (!match) {
      log.warning(
        `Fotocasa: script __initial_props__ não encontrado em ${request.url}. Encerrando paginação.`,
      );
      return;
    }

    let data: FcData;
    try {
      data = JSON.parse(match[1]) as FcData;
    } catch (err) {
      log.warning(
        `Fotocasa: falha ao parsear JSON em ${request.url} — ${String(err)}. Encerrando paginação.`,
      );
      return;
    }

    const realEstates = data?.initialSearch?.result?.realEstates ?? [];
    log.info(
      `Fotocasa: página ${currentPage} → ${realEstates.length} imóveis no JSON.`,
    );

    // Sem resultados nesta página — para a paginação
    if (realEstates.length === 0) {
      // Fallback: as capitais de província usam "<cidade>-capital" no Fotocasa
      // (ex: Barcelona → barcelona-capital). Se a busca simples veio vazia na
      // 1ª página, tenta a variante "-capital" antes de desistir.
      if (currentPage === 1 && !citySlug.endsWith('-capital')) {
        const capitalSlug = `${citySlug}-capital`;
        log.info(`Fotocasa: 0 imóveis para "${citySlug}" — a tentar "${capitalSlug}".`);
        await requestQueue.addRequest({
          url: buildUrl(capitalSlug, 1),
          userData: { page: 1, citySlug: capitalSlug },
        });
        return;
      }
      log.info('Fotocasa: sem mais imóveis, paginação encerrada.');
      return;
    }

    for (const re of realEstates) {
      if (pushed >= maxResults) break;

      try {
        // --- Dedup ---
        const id = String(re.realEstateAdId ?? re.id ?? '');
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);

        // --- Preço ---
        const price_total: number | null =
          typeof re.rawPrice === 'number' ? re.rawPrice : null;

        // --- Quartos ---
        const roomsFeature = (re.features ?? []).find((f) => f.key === 'rooms');
        const num_beds: number | null =
          roomsFeature != null ? roomsFeature.value : null;

        // --- Filtros de negócio ---
        if (num_beds !== null && num_beds < minBeds) continue;
        if (
          price_total !== null &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          continue;
        }

        // --- Mobília ---
        const hasNotFurnished = (re.features ?? []).some(
          (f) => f.key === 'not_furnished',
        );
        const furnished = !hasNotFurnished;

        // --- Endereço ---
        const address = buildAddress(re.address);

        // --- URL ---
        const detailPath =
          re.detail?.['es-ES'] ?? re.detailWithParams?.['es-ES'] ?? '';
        const url = detailPath
          ? `https://www.fotocasa.es${detailPath}`
          : request.loadedUrl ?? request.url;

        // --- Imagens ---
        const images = (re.multimedia ?? [])
          .filter((m) => m.type === 'image')
          .map((m) => m.src)
          .slice(0, 6);

        // --- Coordenadas ---
        const lat: number | null = re.coordinates?.latitude ?? null;
        const lng: number | null = re.coordinates?.longitude ?? null;

        // --- Título ---
        const title = buildTitle(re);

        await Actor.pushData({
          title,
          address,
          price_total,
          num_beds,
          furnished,
          url,
          platform: PLATFORM,
          images,
          lat,
          lng,
        });

        pushed++;
        log.debug(`Fotocasa: #${pushed} — ${title} | ${price_total}€ | ${num_beds} quartos`);
      } catch (err) {
        // Imóvel malformado — continua para o próximo
        log.warning(`Fotocasa: erro ao processar imóvel — ${String(err)}`);
        continue;
      }
    }

    // --- Paginação ---
    if (pushed < maxResults && currentPage < MAX_PAGES && realEstates.length > 0) {
      const nextPage = currentPage + 1;
      await requestQueue.addRequest({
        url: buildUrl(citySlug, nextPage),
        userData: { page: nextPage, citySlug },
      });
      log.info(`Fotocasa: enfileirando página ${nextPage}.`);
    }
  },
});

await crawler.run();
log.info(`Fotocasa: scraping concluído. ${pushed} imóveis recolhidos.`);
await Actor.exit();
