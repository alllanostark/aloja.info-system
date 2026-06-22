import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

interface MilanunciosTag {
  type: string;
  text: string;
}

interface MilanunciosAd {
  id: number;
  title: string;
  description?: string;
  url: string;
  price?: {
    cashPrice?: {
      value?: number;
    };
  };
  location?: {
    city?: { name?: string };
    province?: { name?: string };
  };
  images?: string[];
  tags?: MilanunciosTag[];
}

interface MilanunciosPagination {
  page: number;
  totalPages: number;
  resultsPerPage: number;
  totalAds: number;
}

interface MilanunciosData {
  adListPagination?: {
    adList?: {
      ads?: MilanunciosAd[];
    };
    pagination?: MilanunciosPagination;
  };
}

interface OutputItem {
  title: string | null;
  address: string | null;
  price_total: number | null;
  num_beds: number | null;
  furnished: boolean;
  url: string;
  platform: 'milanuncios';
  images: string[];
  lat: null;
  lng: null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PLATFORM = 'milanuncios' as const;
const MAX_PAGES = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extrai o título limpo a partir da description:
 * - Remove o prefixo "Ref: XXX." inicial
 * - Usa a primeira frase/linha (até ~80 chars)
 * - Fallback para ad.title
 */
function extractTitle(ad: MilanunciosAd): string | null {
  const desc = ad.description?.trim();
  if (desc) {
    // Remove "Ref: ABC123." do inicio (case-insensitive, qualquer separador)
    const cleaned = desc.replace(/^ref\s*:\s*[^\.\n]+\.\s*/i, '').trim();
    if (cleaned.length > 0) {
      // Pega até ao primeiro ponto final, newline ou 80 chars
      const firstSentence = cleaned.split(/[\n.]/)[0].trim();
      return firstSentence.slice(0, 80) || ad.title || null;
    }
  }
  return ad.title || null;
}

/**
 * Extrai num_beds a partir do campo tags (type='dormitorios').
 * Muito mais fiavel que regex no texto: 41/41 ads no HTML de amostra têm esta tag.
 * Fallback para regex no texto combinado (title + description).
 */
function extractBeds(ad: MilanunciosAd): number | null {
  // Fonte primária: tags estruturadas
  const dormTag = ad.tags?.find((t) => t.type === 'dormitorios');
  if (dormTag) {
    const n = parseInt(dormTag.text, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }

  // Fallback: regex no texto livre
  const text = `${ad.title ?? ''} ${ad.description ?? ''}`;
  const m = text.match(/(\d+)\s*(?:hab\b|habitacion(?:es)?|dormitor(?:io)?s?)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

/**
 * Determina se o imóvel está mobilado.
 * "sin amueblar" / "no amueblado" / "sin muebles" → false (sem mobília).
 * Caso contrário → true (assume mobilado ou desconhecido, conservador para resultados).
 */
function extractFurnished(ad: MilanunciosAd): boolean {
  const text = `${ad.title ?? ''} ${ad.description ?? ''}`;
  return !/sin amueblar|no amueblado|sin muebles/i.test(text);
}

/**
 * Constrói o endereço a partir dos campos location.
 * Milanuncios: city.name + ", " + province.name quando diferentes.
 */
function extractAddress(ad: MilanunciosAd): string | null {
  const city = ad.location?.city?.name;
  const province = ad.location?.province?.name;
  if (!city) return province ?? null;
  if (province && province !== city) return `${city}, ${province}`;
  return city;
}

/**
 * Prefixa "https://" nas URLs de imagem (que chegam sem protocolo).
 * O CDN (images-re.milanuncios.com) serve os ficheiros SEM extensao (HTTP 200, content-type: image/jpeg).
 * NAO acrescentar sufixo — testado e confirmado contra /tmp/milanuncios.html.
 */
function extractImages(ad: MilanunciosAd): string[] {
  return (ad.images ?? [])
    .filter((img) => typeof img === 'string' && img.length > 0)
    .map((img) => (img.startsWith('http') ? img : `https://${img}`))
    .slice(0, 6);
}

/**
 * Parseia o bloco window.__INITIAL_PROPS__ do HTML bruto.
 * Formato: window.__INITIAL_PROPS__ = JSON.parse("<string-json-escapada>")
 * Requer duplo parse: 1° desescapa a string JS, 2° parseia o objeto.
 */
function parseInitialProps(html: string): MilanunciosData | null {
  const m = html.match(
    /window\.__INITIAL_PROPS__\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/s,
  );
  if (!m) return null;
  try {
    const innerString: string = JSON.parse(m[1]); // 1° parse: desescapa a string JS
    return JSON.parse(innerString) as MilanunciosData; // 2° parse: parseia o objeto
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Actor principal
// ---------------------------------------------------------------------------

await Actor.init();

const {
  location,
  maxResults = 50,
  minBeds,
  maxPricePerPerson,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" e obrigatorio. Exemplo: "barcelona"');
  await Actor.exit({ exitCode: 1 });
}

// Slug: remove acentos, minúsculas, espaços → hifens
const slug = location
  .split(',')[0]
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, '-');

const startUrl = `https://www.milanuncios.com/alquiler-de-pisos-en-${slug}/`;

log.info(`${PLATFORM}: slug="${slug}" | startUrl=${startUrl}`);
log.info(
  `${PLATFORM}: filtros — minBeds=${minBeds ?? 'n/a'} | maxPricePerPerson=${maxPricePerPerson ?? 'n/a'} | maxResults=${maxResults} | MAX_PAGES=${MAX_PAGES}`,
);

// Dedup por id de anúncio
const seenIds = new Set<number>();
let pushed = 0;

const proxyConfiguration = await Actor.createProxyConfiguration({
  // RESIDENTIAL ES: evita bloqueio por IP de datacenter em Milanuncios (Adevinta).
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 90,
  additionalMimeTypes: ['text/html'],

  async requestHandler({ body, request }) {
    if (pushed >= maxResults) return;

    const pageLabel = request.userData['page'] as number | undefined;
    const pageNum = pageLabel ?? 1;
    log.info(`${PLATFORM}: a processar página ${pageNum} | ${request.url}`);

    // Extrai o JSON do body bruto (não usa o $ do Cheerio — é SSR, não DOM)
    const html = body.toString();

    const data = parseInitialProps(html);

    if (!data) {
      log.warning(
        `${PLATFORM}: window.__INITIAL_PROPS__ nao encontrado em ${request.url} — estrutura pode ter mudado.`,
      );
      return;
    }

    const ads: MilanunciosAd[] = data.adListPagination?.adList?.ads ?? [];
    const pagination: MilanunciosPagination | undefined =
      data.adListPagination?.pagination;

    log.info(
      `${PLATFORM}: ${ads.length} ads na página ${pageNum} | total=${pagination?.totalAds ?? '?'} | totalPages=${pagination?.totalPages ?? '?'}`,
    );

    if (ads.length === 0) {
      log.info(`${PLATFORM}: sem ads na página ${pageNum} — a parar paginação.`);
      return;
    }

    for (const ad of ads) {
      if (pushed >= maxResults) break;

      try {
        // Dedup
        if (seenIds.has(ad.id)) continue;
        seenIds.add(ad.id);

        const price_total: number | null =
          ad.price?.cashPrice?.value ?? null;
        const num_beds: number | null = extractBeds(ad);
        const furnished: boolean = extractFurnished(ad);
        const title: string | null = extractTitle(ad);
        const address: string | null = extractAddress(ad);
        const url: string = `https://www.milanuncios.com${ad.url}`;
        const images: string[] = extractImages(ad);

        // Filtro: quartos minimos (apenas quando conhecido)
        if (
          minBeds != null &&
          num_beds != null &&
          num_beds < minBeds
        ) {
          continue;
        }

        // Filtro: preco por pessoa (apenas quando ambos conhecidos e num_beds>0)
        if (
          maxPricePerPerson != null &&
          price_total != null &&
          num_beds != null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          continue;
        }

        const item: OutputItem = {
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

        await Actor.pushData(item);
        pushed++;
      } catch (err) {
        log.warning(
          `${PLATFORM}: erro a processar ad id=${ad.id}: ${String(err)}`,
        );
      }
    }

    // Paginacao: ?pagina=N
    // Continua se: ainda há resultados, não atingiu maxResults, não passou MAX_PAGES
    if (
      pushed < maxResults &&
      ads.length > 0 &&
      pageNum < MAX_PAGES &&
      pagination != null &&
      pageNum < pagination.totalPages
    ) {
      const nextPage = pageNum + 1;
      // URL de próxima página: base + ?pagina=N
      const baseUrl = request.url.split('?')[0];
      const nextUrl = `${baseUrl}?pagina=${nextPage}`;

      log.info(`${PLATFORM}: a enfileirar página ${nextPage} | ${nextUrl}`);

      await crawler.addRequests([
        {
          url: nextUrl,
          userData: { page: nextPage },
        },
      ]);
    }
  },
});

await crawler.run([{ url: startUrl, userData: { page: 1 } }]);

log.info(`${PLATFORM}: concluido — ${pushed} imoveis recolhidos.`);

await Actor.exit();
