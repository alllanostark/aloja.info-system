import { Actor } from 'apify';
import { CheerioCrawler, log, RequestQueue } from 'crawlee';

// ---------------------------------------------------------------------------
// ANTI-BOT: CheerioCrawler + got-scraping
//
// O CheerioCrawler usa got-scraping internamente. O got-scraping imita o
// handshake TLS/HTTP2 e os headers HTTP do Chrome real sem abrir qualquer
// browser. Esta abordagem venceu o DataDome do Airbnb e e a razao pela qual
// substituimos o PlaywrightCrawler: sem processo de browser headless, sem
// CDP Runtime.enable, sem fingerprint de WebDriver — os sinais que o DataDome
// usa como triggers primarios desaparecem completamente.
//
// Stack de protecao:
//   - got-scraping: TLS/JA3 e headers identicos a Chrome real (default do CheerioCrawler)
//   - Proxy RESIDENTIAL ES: IP residencial espanhol
//   - useSessionPool + persistCookiesPerSession: cookies (incluindo datadome
//     se emitido) persistem por sessao; 403/captcha reciclam sessao/IP
//   - retryOnBlocked: Crawlee deteta 403/captcha e reencaminha automaticamente
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

const PLATFORM = 'idealista';
const MAX_PAGES = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte string com digitos para inteiro; devolve null se invalido. */
const toInt = (s?: string | null): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Inicializacao
// ---------------------------------------------------------------------------

await Actor.init();

const {
  location,
  maxResults = 25,
  minBeds = 1,
  maxPricePerPerson = 450,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" e obrigatorio.');
  await Actor.exit();
}

// Constroi slug no formato do Idealista: "barcelona", "l-hospitalet-de-llobregat"
const slug = location
  .split(',')[0]
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, '-');

// Dedup por data-element-id — nunca faz push do mesmo anuncio duas vezes
const seenIds = new Set<string>();

let pushed = 0;

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

const buildUrl = (page: number): string =>
  page === 1
    ? `https://www.idealista.com/alquiler-viviendas/${slug}/`
    : `https://www.idealista.com/alquiler-viviendas/${slug}/pagina-${page}.htm`;

// ---------------------------------------------------------------------------
// Proxy + Queue
// ---------------------------------------------------------------------------

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

const requestQueue = await RequestQueue.open();

// Enfileira a primeira pagina de listings directamente — sem warm-up de browser
await requestQueue.addRequest({
  url: buildUrl(1),
  userData: { page: 1 },
});

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

const crawler = new CheerioCrawler({
  proxyConfiguration,
  requestQueue,

  // got-scraping e o default do CheerioCrawler — nao precisa de configuracao extra.
  // Imita TLS/HTTP2/headers do Chrome real automaticamente.

  maxRequestRetries: 6,

  // retryOnBlocked: Crawlee deteta respostas de bloqueio (403, captcha, paginas
  // de desafio) e recicla a sessao/IP automaticamente antes de fazer retry.
  retryOnBlocked: true,

  // SessionPool: reutiliza cookies (incluindo qualquer cookie datadome emitido
  // pelo servidor) dentro da mesma sessao. Sessoes com erro sao aposentadas.
  useSessionPool: true,
  persistCookiesPerSession: true,
  sessionPoolOptions: {
    maxPoolSize: 10,
  },

  async requestHandler({ $, request }) {
    if (pushed >= maxResults) return;

    const currentPage = request.userData.page as number;

    // ------------------------------------------------------------------
    // Detecao de bloqueio: 0 cards pode ser 403/DataDome ou sem resultados
    // ------------------------------------------------------------------
    const cardCount = $('article.item').length;

    if (cardCount === 0) {
      log.warning(
        `Idealista: 0 cards em ${request.url} (pagina ${currentPage}) — ` +
          'possivel 403/DataDome ou sem resultados para este slug/pagina.',
      );
      return;
    }

    log.info(
      `[Idealista] Pagina ${currentPage}: ${cardCount} cards encontrados em ${request.url}`,
    );

    let pageCount = 0;

    // ------------------------------------------------------------------
    // Iterar sobre cada article.item
    // ------------------------------------------------------------------
    $('article.item').each((_i, el) => {
      if (pushed >= maxResults) return; // limite atingido — salta

      try {
        const card = $(el);

        // ----------------------------------------------------------------
        // ID do anuncio (data-element-id no article.item)
        // ----------------------------------------------------------------
        const elementId = card.attr('data-element-id') ?? null;

        if (!elementId) {
          log.debug('[Idealista] Card sem data-element-id — ignorado.');
          return; // continue do .each
        }

        // Dedup
        if (seenIds.has(elementId)) {
          log.debug(`[Idealista] ID ${elementId} ja processado — ignorado.`);
          return;
        }

        // ----------------------------------------------------------------
        // URL — construida sempre a partir do ID (href vem ofuscado)
        // ----------------------------------------------------------------
        const url = `https://www.idealista.com/inmueble/${elementId}/`;

        // ----------------------------------------------------------------
        // Titulo
        // ----------------------------------------------------------------
        const title = card.find('a.item-link').text().trim() || null;

        // ----------------------------------------------------------------
        // Morada — extraida do titulo apos " en "
        // ----------------------------------------------------------------
        let address: string | null = null;
        if (title) {
          const match = title.match(/\sen\s(.+)/i);
          address = match ? match[1].trim() : title;
        }

        // ----------------------------------------------------------------
        // Preco — "1.589€/mes" em span.item-price → 1589
        // ----------------------------------------------------------------
        const priceRaw = card.find('span.item-price').first().text().trim();
        const price_total = toInt(priceRaw) ?? null;

        // ----------------------------------------------------------------
        // Quartos — percorre .item-detail-char .item-detail, encontra /(\d+)\s*hab/i
        // ----------------------------------------------------------------
        let num_beds: number | null = null;

        card.find('.item-detail-char .item-detail').each((_j, detailEl) => {
          if (num_beds !== null) return; // ja encontrou
          const text = $(detailEl).text();
          const m = text.match(/(\d+)\s*hab/i);
          if (m) {
            const parsed = parseInt(m[1], 10);
            if (Number.isFinite(parsed)) {
              num_beds = parsed;
            }
          }
        });

        // ----------------------------------------------------------------
        // Mobilia — default true; false se texto do card indicar sem mobilia
        // ----------------------------------------------------------------
        const cardText = card.text();
        const furnished = !/sin amueblar|sin muebles/i.test(cardText);

        // ----------------------------------------------------------------
        // Imagens — atributo src das img dentro do card; filtra http; slice 6
        // ----------------------------------------------------------------
        const images: string[] = [];
        card.find('img').each((_k, imgEl) => {
          if (images.length >= 6) return;
          const src = $(imgEl).attr('src') ?? '';
          if (src.startsWith('http')) {
            images.push(src);
          }
        });

        // ----------------------------------------------------------------
        // Filtros de negocio
        // ----------------------------------------------------------------
        if (num_beds !== null && num_beds < minBeds) {
          log.debug(
            `[Idealista] ID ${elementId} ignorado: ${num_beds} quartos < minBeds ${minBeds}`,
          );
          return;
        }

        if (
          price_total !== null &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          log.debug(
            `[Idealista] ID ${elementId} ignorado: preco/pessoa ` +
              `${Math.round(price_total / num_beds)}€ > maxPricePerPerson ${maxPricePerPerson}€`,
          );
          return;
        }

        // ----------------------------------------------------------------
        // Push — shape exato esperado pelo app (NAO ALTERAR)
        // ----------------------------------------------------------------
        void Actor.pushData({
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
        });

        seenIds.add(elementId);
        pushed++;
        pageCount++;

        log.debug(
          `[Idealista] Imovel #${pushed} (ID ${elementId}): ` +
            `${title ?? 'sem titulo'} — ${price_total ?? '?'}€`,
        );

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.debug(`[Idealista] Erro a processar card — ignorado. Detalhe: ${msg}`);
      }
    });

    log.info(
      `[Idealista] Pagina ${currentPage} concluida: ${pageCount} imoveis adicionados ` +
        `(total: ${pushed}/${maxResults})`,
    );

    // ------------------------------------------------------------------
    // Paginacao — seletor validado: a.icon-arrow-right-after
    // Fallback: constroi /pagina-N.htm
    // ------------------------------------------------------------------
    if (pushed >= maxResults) return;

    const nextPage = currentPage + 1;
    if (nextPage > MAX_PAGES) {
      log.info(`[Idealista] Limite de ${MAX_PAGES} paginas atingido.`);
      return;
    }

    // Tenta extrair href do botao "proxima pagina"
    let nextUrl: string | null = null;

    const nextHref = $('a.icon-arrow-right-after').first().attr('href') ?? null;
    if (nextHref) {
      nextUrl = new URL(nextHref, 'https://www.idealista.com').href;
    }

    // Fallback: constroi URL de paginacao manualmente
    if (!nextUrl && cardCount > 0) {
      nextUrl = buildUrl(nextPage);
      log.debug(`[Idealista] Paginacao por fallback: ${nextUrl}`);
    }

    if (nextUrl) {
      await requestQueue.addRequest({
        url: nextUrl,
        userData: { page: nextPage },
      });
      log.info(`[Idealista] Paginacao: a ir para pagina ${nextPage} — ${nextUrl}`);
    } else {
      log.info(`[Idealista] Sem pagina seguinte detetada apos pagina ${currentPage}.`);
    }
  },
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

await crawler.run();
log.info(`[Idealista] Scraping concluido. ${pushed} imoveis recolhidos (max: ${maxResults}).`);
await Actor.exit();
