// ════════════════════════════════════════════════════════════
// Motor de scraping — orquestração Apify das 7 plataformas
//
// Arquitetura resiliente:
//   - cada plataforma corre em paralelo (Promise.allSettled)
//   - timeout por ator (não bloqueia as outras)
//   - normalização para o shape de search_results
//   - degradação graciosa: falha numa plataforma não quebra a busca
//
// Atores Apify configuram-se por env (APIFY_ACTOR_<PLATAFORMA>). Para as
// plataformas sem ator configurado — ou quando o ator falha — o motor usa
// um gerador de candidatos realista (sinalizado como "demonstração") para
// que o pipeline (drive-time, combinações, guardar/descartar) funcione já.
// ════════════════════════════════════════════════════════════

import type { PropertyPlatform } from "@/types";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";

// Homyspace saiu da busca ativa (B2B sem grelha pública) — substituído por
// Spotahome + Uniplaces (aluguer mensal mobilado). Continua no tipo/enum
// para integridade de dados históricos.
export const PLATFORMS: PropertyPlatform[] = [
  // Apenas plataformas com ator afinado e funcional (senão geram demo/erro e
  // poluem os resultados reais). Idealista fica de fora (DataDome bloqueia mesmo
  // com residencial — precisa de desbloqueador pago); vivara/homyspace sem ator.
  "fotocasa",
  "habitaclia",
  "spotahome",
  "uniplaces",
  "milanuncios",
  "airbnb",
  "pisos",
  "yaencontre",
];

/** Fiabilidade conhecida (anti-bot). Informativo para a UI. */
export const PLATFORM_RELIABILITY: Record<PropertyPlatform, "stable" | "unstable"> = {
  idealista: "unstable",
  fotocasa: "stable",
  habitaclia: "stable",
  homyspace: "stable",
  milanuncios: "stable",
  airbnb: "unstable",
  vivara: "stable",
  spotahome: "stable",
  uniplaces: "stable",
  pisos: "stable",
  yaencontre: "unstable",
};

/** Ator Apify por plataforma (configurável por env). */
function actorFor(platform: PropertyPlatform): string | undefined {
  const env = process.env[`APIFY_ACTOR_${platform.toUpperCase()}`];
  if (!env || !env.trim()) return undefined;
  // A API REST da Apify usa "username~actor" no path; "username/actor" dá 404.
  return env.trim().replace("/", "~");
}

// Há pelo menos um ator real configurado? Se sim, plataformas sem ator ficam
// VAZIAS (não geram demo) — evita misturar imóveis reais com fictícios.
const ANY_ACTOR_CONFIGURED = Object.keys(process.env).some(
  (k) => k.startsWith("APIFY_ACTOR_") && (process.env[k] ?? "").trim() !== ""
);

export interface SearchParams {
  obraAddress: string;
  /** Cidade extraída do endereço (geocode). */
  obraCity?: string | null;
  /** Província (geocode) — termo de busca PREFERENCIAL dos atores: existe nas
   *  plataformas mesmo quando a vila/cidade pequena não tem página própria.
   *  Sem isto, vilas como "Sant Jaume de Llierca" caem em listagem nacional. */
  obraProvince?: string | null;
  obraLat: number;
  obraLng: number;
  numWorkers: number;
  budgetPerPerson: number;
  maxDriveMinutes: number;
}

export interface ScrapedListing {
  platform: PropertyPlatform;
  external_url: string | null;
  title: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  total_price: number | null;
  num_beds: number | null;
  furnished: boolean;
  images: string[];
  raw_data: Record<string, unknown>;
}

export interface PlatformStatus {
  platform: PropertyPlatform;
  status: "ok" | "empty" | "error" | "demo";
  count: number;
  message?: string;
}

export interface SearchOutcome {
  listings: ScrapedListing[];
  platformStatus: PlatformStatus[];
}

// ─────────────────────────────────────────────────────────────
// Apify real
// ─────────────────────────────────────────────────────────────

async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`Apify ${actorId}: HTTP ${res.status}`);
    const items = await res.json();
    return Array.isArray(items) ? items : [];
  } finally {
    clearTimeout(timer);
  }
}

/** Normaliza um item bruto de ator para o nosso shape (best-effort, tolerante). */
function normalize(
  platform: PropertyPlatform,
  raw: Record<string, unknown>
): ScrapedListing {
  const num = (v: unknown): number | null => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseInt(v.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v : null;

  const price =
    num(raw.price_total) ??
    num(raw.price) ??
    num(raw.priceValue) ??
    num(raw.rent) ??
    num(raw.monthlyPrice);
  const beds =
    num(raw.num_beds) ??
    num(raw.rooms) ??
    num(raw.bedrooms) ??
    num(raw.beds) ??
    num(raw.numRooms);
  // Coordenadas: parser próprio que PRESERVA decimais e sinal. num() removeria
  // o ponto e o "-" (ex. "2.1686" → 21686, "-3.70" → 370), corrompendo lat/lng
  // de qualquer plataforma que devolva coords como string.
  const coord = (v: unknown): number | null => {
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string"
          ? parseFloat(v)
          : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const latRaw = coord(raw.latitude) ?? coord(raw.lat);
  const lngRaw = coord(raw.longitude) ?? coord(raw.lng);
  const validGeo =
    latRaw != null &&
    lngRaw != null &&
    Math.abs(latRaw) <= 90 &&
    Math.abs(lngRaw) <= 180 &&
    !(latRaw === 0 && lngRaw === 0);
  const lat = validGeo ? latRaw : null;
  const lng = validGeo ? lngRaw : null;
  const images = Array.isArray(raw.images)
    ? (raw.images as unknown[]).map(String).slice(0, 6)
    : [];

  return {
    platform,
    external_url: str(raw.url) ?? str(raw.link) ?? null,
    title: str(raw.title) ?? str(raw.name) ?? null,
    address: str(raw.address) ?? str(raw.location) ?? null,
    lat,
    lng,
    total_price: price,
    num_beds: beds,
    furnished: raw.furnished !== false,
    images,
    raw_data: raw,
  };
}

// ─────────────────────────────────────────────────────────────
// Fallback — gerador de candidatos realista (demonstração)
// ─────────────────────────────────────────────────────────────

const STREETS = [
  "Carrer Major", "Avinguda Diagonal", "Carrer de Sants", "Rambla Nova",
  "Carrer del Mar", "Passeig Marítim", "Carrer Indústria", "Avinguda Roma",
  "Carrer Nou", "Plaça Catalunya", "Carrer Ponent", "Avinguda Catalunya",
];

function demoListingsForPlatform(
  platform: PropertyPlatform,
  params: SearchParams,
  count: number
): ScrapedListing[] {
  const out: ScrapedListing[] = [];
  for (let i = 0; i < count; i++) {
    const beds = 1 + Math.floor(Math.random() * 6); // 1..6
    // preço por cama em torno do orçamento (±35%)
    const perBed =
      params.budgetPerPerson * (0.65 + Math.random() * 0.7);
    const total = Math.round((beds * perBed) / 10) * 10;
    const dLat = (Math.random() - 0.5) * 0.18;
    const dLng = (Math.random() - 0.5) * 0.18;
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    const number = 1 + Math.floor(Math.random() * 120);
    const furnished = Math.random() > 0.3;
    out.push({
      platform,
      external_url: `https://${platform}.com/imovel/${platform}-${Date.now()}-${i}`,
      title: `${beds} quartos · ${furnished ? "mobilado" : "sem mobília"}`,
      address: `${street} ${number}`,
      lat: params.obraLat + dLat,
      lng: params.obraLng + dLng,
      total_price: total,
      num_beds: beds,
      furnished,
      images: [],
      raw_data: { source: "fallback-demo" },
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Orquestrador
// ─────────────────────────────────────────────────────────────

async function scrapePlatform(
  platform: PropertyPlatform,
  params: SearchParams
): Promise<{ listings: ScrapedListing[]; status: PlatformStatus }> {
  const actorId = actorFor(platform);

  // Sem ator para esta plataforma:
  if (!actorId || !APIFY_TOKEN) {
    // Se já há atores reais ligados noutras plataformas, esta fica vazia
    // (não polui os resultados reais com imóveis de demonstração).
    if (ANY_ACTOR_CONFIGURED && APIFY_TOKEN) {
      return {
        listings: [],
        status: {
          platform,
          status: "empty",
          count: 0,
          message: "Plataforma ainda não ligada.",
        },
      };
    }
    // Modo demonstração total (nenhum ator configurado em lado nenhum).
    const listings = demoListingsForPlatform(
      platform,
      params,
      2 + Math.floor(Math.random() * 3)
    );
    return {
      listings,
      status: {
        platform,
        status: "demo",
        count: listings.length,
        message: "Sem ator configurado — resultados de demonstração.",
      },
    };
  }

  try {
    const raw = await runActor(actorId, {
      // Província primeiro (existe nas plataformas); cidade e morada como fallback.
      location: params.obraProvince || params.obraCity || params.obraAddress,
      maxResults: 25,
      maxItems: 25,
      minBeds: 1,
      maxPricePerPerson: params.budgetPerPerson,
      operation: "rent",
    });
    const listings = raw
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r != null)
      .map((r) => normalize(platform, r));
    return {
      listings,
      status: {
        platform,
        status: listings.length ? "ok" : "empty",
        count: listings.length,
      },
    };
  } catch (err) {
    return {
      listings: [],
      status: {
        platform,
        status: "error",
        count: 0,
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

/** Corre todas as plataformas em paralelo e agrega resultados. */
export async function searchAllPlatforms(
  params: SearchParams
): Promise<SearchOutcome> {
  const settled = await Promise.allSettled(
    PLATFORMS.map((p) => scrapePlatform(p, params))
  );

  const listings: ScrapedListing[] = [];
  const platformStatus: PlatformStatus[] = [];

  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      listings.push(...res.value.listings);
      platformStatus.push(res.value.status);
    } else {
      platformStatus.push({
        platform: PLATFORMS[i],
        status: "error",
        count: 0,
        message: String(res.reason),
      });
    }
  });

  return { listings, platformStatus };
}
