/**
 * Apify Actor — Airbnb (CheerioCrawler / fetch + JSON embebido)
 *
 * AVISO ANTI-BOT: Airbnb usa DataDome. Fetch simples pode passar localmente
 * mas ser bloqueado na nuvem Apify. Se o data-deferred-state não aparecer,
 * o actor termina graciosamente com warning — não é bug do código.
 *
 * Estratégia: extrair o bloco JSON <script id="data-deferred-state-0"> que
 * contém todos os dados de pesquisa injetados pelo servidor (SSR React).
 * Caminho validado contra HTML real de Barcelona (Junho 2026):
 *   niobeClientData[0][1].data.presentation.staysSearch.results.searchResults
 */

import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  minBeds?: number;
  maxPricePerPerson?: number;
}

interface ListingOutput {
  title: string | null;
  address: string | null;
  price_total: number | null;
  num_beds: number | null;
  furnished: true;
  url: string;
  platform: 'airbnb';
  images: string[];
  lat: number | null;
  lng: number | null;
}

// Estrutura mínima que precisamos do JSON do Airbnb
interface AirbnbSearchResult {
  title?: string;
  nameLocalized?: {
    localizedStringWithTranslationPreference?: string;
  };
  structuredDisplayPrice?: {
    primaryLine?: {
      price?: string;
    };
  };
  contextualPictures?: Array<{ picture?: string }>;
  demandStayListing?: {
    id?: string;
    location?: {
      coordinate?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove tudo que não seja dígito e converte para inteiro. */
const toInt = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Heurística de quartos a partir do texto do título/address.
 * Exemplos cobertos:
 *   "Habitación moderna"           -> 1
 *   "2 habitaciones en el centro"  -> 2
 *   "Loft moderno en Gràcia"       -> 1
 *   "Entenca 208 Habitación 3..."  -> 3  (número imediatamente antes de "hab")
 *
 * Regra: o número é válido APENAS se estiver separado por espaço/hífen de
 * "habitaci" / "bedroom" / "room" — e não for um número de rua isolado
 * (ex: "Entenca 208" sem "hab" a seguir). O regex exige que o número seja
 * seguido diretamente pelo termo.
 */
const bedsFromText = (text: string | null | undefined): number | null => {
  const t = (text ?? '').toLowerCase();

  // "3 habitaciones", "2 bedrooms", "2 rooms" — número IMEDIATAMENTE antes do termo
  const mNum = t.match(/\b(\d{1,2})\s*(?:habitaci[oó]n(?:es)?|bedroom[s]?|room[s]?)\b/);
  if (mNum) return parseInt(mNum[1], 10);

  // "habitación" / "habitaciones" sem número -> 1
  if (/\bhabitaci[oó]n(?:es)?\b/.test(t)) return 1;

  // "bedroom" / "bedrooms" / "room" sem número -> 1
  if (/\bbedroom[s]?\b|\broom[s]?\b/.test(t)) return 1;

  // estúdio / loft -> 1 (quarto único)
  if (/\bestudio\b|\bstudio\b|\bloft\b/.test(t)) return 1;

  return null;
};

/**
 * Busca recursiva pela primeira chave `searchResults` que seja um array
 * com pelo menos um elemento. Robusto a mudanças de path no JSON do Airbnb.
 */
const findSearchResults = (
  obj: unknown,
  depth = 0,
): AirbnbSearchResult[] | null => {
  if (depth > 20 || typeof obj !== 'object' || obj === null) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findSearchResults(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  if (
    'searchResults' in record &&
    Array.isArray(record.searchResults) &&
    record.searchResults.length > 0
  ) {
    return record.searchResults as AirbnbSearchResult[];
  }

  for (const val of Object.values(record)) {
    const found = findSearchResults(val, depth + 1);
    if (found) return found;
  }
  return null;
};

/**
 * Descodifica o id Base64 do Airbnb para o ID numérico da sala.
 *   "RGVtYW5kU3RheUxpc3Rpbmc6MTcxMTYzMjIy..." -> "1711632229620557498"
 */
const decodeListingId = (b64: string): string | null => {
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    // Formato: "DemandStayListing:<numericId>"
    const parts = decoded.split(':');
    return parts.length >= 2 ? parts[1] : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Actor principal
// ---------------------------------------------------------------------------

await Actor.init();

const input = (await Actor.getInput<Input>()) ?? { location: '' };
const {
  location,
  minBeds = 1,
  maxPricePerPerson = 1000,
} = input;

if (!location) {
  log.error('Input "location" é obrigatório. Ex: { "location": "Barcelona" }');
  await Actor.exit();
}

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

// URL de pesquisa mensal — página única (MAX_PAGES = 1)
// Airbnb usa cursor complexo para paginação; não paginamos aqui.
const searchUrl =
  `https://www.airbnb.es/s/${encodeURIComponent(location)}--Spain/homes` +
  `?monthly_length=1&flexible_trip_lengths%5B%5D=one_month`;

log.info(`Airbnb actor a iniciar. location="${location}" url=${searchUrl}`);

const seenIds = new Set<string>();

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,

  async requestHandler({ body, request }) {
    // body pode ser Buffer ou string — normaliza para string
    const html = typeof body === 'string' ? body : body.toString('utf8');

    // -------------------------------------------------------------------------
    // 1. Extrai o bloco JSON do script data-deferred-state
    // -------------------------------------------------------------------------
    const scriptMatch = html.match(
      /<script\s+id="data-deferred-state[^"]*"[^>]*>([\s\S]*?)<\/script>/,
    );

    if (!scriptMatch) {
      log.warning(
        `Airbnb: script "data-deferred-state" não encontrado em ${request.url}. ` +
        `Possível bloqueio DataDome ou mudança de estrutura HTML. Actor a terminar.`,
      );
      return;
    }

    // -------------------------------------------------------------------------
    // 2. Parse JSON
    // -------------------------------------------------------------------------
    let pageData: unknown;
    try {
      pageData = JSON.parse(scriptMatch[1]);
    } catch (e) {
      log.warning(`Airbnb: falha ao fazer parse do JSON embebido: ${e}. Actor a terminar.`);
      return;
    }

    // -------------------------------------------------------------------------
    // 3. Encontra searchResults (busca recursiva)
    // -------------------------------------------------------------------------
    const searchResults = findSearchResults(pageData);

    if (!searchResults || searchResults.length === 0) {
      log.warning(
        `Airbnb: searchResults não encontrado ou vazio em ${request.url}. ` +
        `Possível bloqueio DataDome ou sem resultados para "${location}". Actor a terminar.`,
      );
      return;
    }

    log.info(`Airbnb: ${searchResults.length} searchResults encontrados.`);

    // -------------------------------------------------------------------------
    // 4. Filtra e mapeia listings
    // -------------------------------------------------------------------------
    const listings = searchResults.filter((r) => !!r.demandStayListing);

    if (listings.length === 0) {
      log.warning('Airbnb: nenhum item com demandStayListing. Possivelmente só separadores/anúncios.');
      return;
    }

    log.info(`Airbnb: ${listings.length} listings com demandStayListing.`);

    let pushed = 0;

    for (const r of listings) {
      try {
        // --- ID e URL ---
        const idB64 = r.demandStayListing?.id;
        if (!idB64) {
          log.debug('Airbnb: listing sem id, ignorado.');
          continue;
        }

        const numericId = decodeListingId(idB64);
        if (!numericId) {
          log.debug(`Airbnb: falha ao descodificar id "${idB64}", ignorado.`);
          continue;
        }

        if (seenIds.has(numericId)) continue;
        seenIds.add(numericId);

        const url = `https://www.airbnb.es/rooms/${numericId}`;

        // --- Title ---
        // nameLocalized tem o nome real do anúncio (ex: "Acogedora habitación con espacio de trabajo")
        // r.title tem a zona/tipo (ex: "Alojamiento en Eixample") — usado como address
        const title =
          r.nameLocalized?.localizedStringWithTranslationPreference ??
          r.title ??
          null;

        // --- Address ---
        // r.title contém "Apartamento en Eixample", "Habitación en Gràcia", etc.
        const address = r.title ?? null;

        // --- Preço mensal total ---
        const priceStr = r.structuredDisplayPrice?.primaryLine?.price;
        const price_total = toInt(priceStr);

        // --- Coordenadas ---
        const lat = r.demandStayListing?.location?.coordinate?.latitude ?? null;
        const lng = r.demandStayListing?.location?.coordinate?.longitude ?? null;

        // --- Imagens ---
        const images = (r.contextualPictures ?? [])
          .map((p) => p.picture ?? '')
          .filter(Boolean)
          .slice(0, 6);

        // --- Número de quartos (heurística) ---
        const combinedText = `${title ?? ''} ${address ?? ''}`;
        const num_beds = bedsFromText(combinedText);

        // --- Filtros ---
        // Descarta se num_beds conhecido e abaixo do mínimo
        if (num_beds !== null && num_beds < minBeds) {
          log.debug(`Airbnb: "${title}" descartado (beds=${num_beds} < minBeds=${minBeds})`);
          continue;
        }

        // Descarta se preço/pessoa acima do máximo (só quando ambos conhecidos e beds > 0)
        if (
          price_total !== null &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          log.debug(
            `Airbnb: "${title}" descartado (${price_total}/${num_beds}=` +
            `${Math.round(price_total / num_beds)} > maxPricePerPerson=${maxPricePerPerson})`,
          );
          continue;
        }

        // --- Push ---
        const output: ListingOutput = {
          title,
          address,
          price_total,
          num_beds,
          furnished: true,
          url,
          platform: 'airbnb',
          images,
          lat: typeof lat === 'number' ? lat : null,
          lng: typeof lng === 'number' ? lng : null,
        };

        await Actor.pushData(output);
        pushed++;
        log.debug(`Airbnb [${pushed}]: ${title} | ${price_total ?? 'sem preço'} | beds=${num_beds ?? '?'}`);

      } catch (err) {
        log.warning(`Airbnb: erro ao processar listing — ${err}`);
      }
    }

    log.info(`Airbnb: ${pushed} listings guardados (de ${listings.length} candidatos).`);
  },
});

await crawler.run([searchUrl]);

log.info(`Airbnb actor concluído. Total guardado: ${seenIds.size} IDs únicos.`);
await Actor.exit();
