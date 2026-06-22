import { Actor } from 'apify';
import { PlaywrightCrawler, log, RequestQueue } from 'crawlee';
import type { ElementHandle } from 'playwright';

// ---------------------------------------------------------------------------
// ANTI-BOT: Idealista usa DataDome (um dos sistemas mais agressivos do mercado).
//
// Stack de 4 camadas implementada:
//
// CAMADA 1 — rebrowser-playwright (package.json + Dockerfile ENV)
//   Substitui o playwright padrão pelo rebrowser-playwright via alias npm.
//   O patch desativa o leak CDP Runtime.enable (principal sinal de automação
//   detetado pelo DataDome ao nível de TLS/protocolo). Configurado com
//   ENV REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding no Dockerfile.
//
// CAMADA 2 — Warm-up obrigatório do cookie datadome
//   O DataDome emite o cookie `datadome` na primeira visita natural à homepage.
//   Sem esse cookie, qualquer request a /alquiler-viviendas/* retorna 403.
//   O primeiro request da fila é sempre a homepage. O requestHandler faz o
//   warm-up completo (consentimento, scroll, navegação para categoria) antes
//   de enfileirar os listings. Os listings herdam a sessão com o cookie válido.
//
// CAMADA 3 — SessionPool com cookie + IP fixos por sessão
//   useSessionPool + persistCookiesPerSession garantem que a mesma sessão
//   (com o cookie datadome gerado no warm-up) é usada em todos os requests
//   subsequentes. 403/429 aposentam a sessão e ativam retry com nova sessão.
//
// CAMADA 4 — Fingerprint coerente ES + comportamento humano + stealth script
//   Locale/timezone Madrid, fingerprints reais Crawlee com locales ['es-ES'],
//   addInitScript de stealth (webdriver, chrome, plugins), scrolls incrementais
//   e delays aleatórios antes de tocar no DOM.
// ---------------------------------------------------------------------------

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

const PLATFORM = 'idealista';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte string com digitos para inteiro; devolve null se invalido. */
const toInt = (s?: string | null): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** Delay humanizado — evita ritmo maquinal detetavel pelo DataDome. */
const humanDelay = (min = 800, max = 2500): Promise<void> =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

/**
 * Tenta extrair textContent de um card usando lista ordenada de seletores CSS.
 * Devolve string vazia se nenhum seletor encontrar elemento.
 */
const safeText = async (
  card: ElementHandle<Element>,
  selectors: string[],
): Promise<string> => {
  for (const sel of selectors) {
    try {
      const text = await card.$eval(sel, (el) => el.textContent ?? '').catch(() => null);
      if (text && text.trim()) return text.trim();
    } catch {
      // seletor nao encontrou — tenta o proximo
    }
  }
  return '';
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

// CAMADA 2 — O primeiro request é SEMPRE a homepage para aquecer o cookie datadome.
// targetPage guarda a página de listings que queremos alcançar depois do warm-up.
await requestQueue.addRequest({
  url: 'https://www.idealista.com',
  userData: { isWarmup: true, targetPage: 1 },
});

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

const crawler = new PlaywrightCrawler({
  proxyConfiguration,
  requestQueue,
  maxRequestRetries: 4,
  requestHandlerTimeoutSecs: 180,
  navigationTimeoutSecs: 90,

  // CAMADA 3 — SessionPool: mantém o cookie datadome e o IP fixos por sessão.
  // persistCookiesPerSession garante que os cookies do warm-up (incluindo o
  // datadome) são preservados e reenviados nos requests seguintes da mesma sessão.
  useSessionPool: true,
  persistCookiesPerSession: true,
  sessionPoolOptions: {
    maxPoolSize: 8,
    sessionOptions: {
      maxUsageCount: 50,
    },
  },

  // CAMADA 4 — Fingerprint coerente ES: Crawlee gera fingerprints reais de
  // browser Chrome com locale español, eliminando divergências entre Accept-Language
  // e navigator.language que o DataDome usa como sinal de inconsistência.
  browserPoolOptions: {
    useFingerprints: true,
    fingerprintOptions: {
      fingerprintGeneratorOptions: {
        locales: ['es-ES'],
        operatingSystems: ['windows', 'macos'],
        browsers: ['chrome'],
      },
    },
  },

  launchContext: {
    launchOptions: {
      // headful via xvfb (a imagem Apify corre xvfb-run) — elimina dezenas de
      // sinais de headless Chrome que o DataDome usa. Mais realista que headless.
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  },

  // CAMADA 4 — preNavigationHooks: aplicado em CADA página antes da navegação.
  // Injeta stealth script e define locale/timezone coerentes com ES.
  preNavigationHooks: [
    async ({ page }) => {
      // Stealth reforçado: garante que webdriver, chrome e plugins são
      // consistentes com um browser real mesmo após o fingerprint-suite atuar.
      await page.addInitScript(() => {
        try {
          // Remove o flag webdriver que o DataDome verifica como primeiro sinal
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true,
          });
        } catch { /* ignorar se já foi removido */ }

        try {
          // Simula presença do objeto chrome (ausente em automação headless)
          if (!('chrome' in window)) {
            Object.defineProperty(window, 'chrome', {
              value: { runtime: {} },
              writable: false,
              configurable: true,
            });
          }
        } catch { /* ignorar */ }

        try {
          // DataDome verifica navigator.plugins.length === 0 como indicador de bot.
          // Não se pode substituir o array nativo, mas pode-se verificar e deixar
          // o fingerprint-suite (que já o popula) tomar conta — este bloco é um
          // safety-net para ambientes onde o fingerprint-suite não atuou.
          if (navigator.plugins.length === 0) {
            Object.defineProperty(navigator, 'plugins', {
              get: () => [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }],
              configurable: true,
            });
          }
        } catch { /* ignorar */ }
      });

      // Locale e timezone coerentes com ES — eliminam divergências de Accept-Language
      // header vs navigator.language detetáveis pelo DataDome.
      await page.emulateMedia({ });
      await page.context().grantPermissions([]);
    },
  ],

  async requestHandler({ page, request, session, response }) {
    // CAMADA 3 — Deteção de bloqueio por status HTTP.
    // 403 e 429 aposentam a sessão para que o retry use nova sessão/IP/cookie.
    if (response && (response.status() === 403 || response.status() === 429)) {
      session?.retire();
      throw new Error(
        `[DataDome] Bloqueado com HTTP ${response.status()} em ${request.url} — sessão aposentada, retry com nova sessão.`,
      );
    }

    // -----------------------------------------------------------------------
    // CAMADA 2 — Ramo de warm-up
    // -----------------------------------------------------------------------
    if (request.userData.isWarmup) {
      log.info('[Warm-up] A iniciar aquecimento de sessão na homepage do Idealista...');

      await page.waitForLoadState('networkidle');

      // Aceitar consentimento RGPD (Didomi) — sem cookie de consent o DataDome
      // pode bloquear requests subsequentes por comportamento anómalo.
      try {
        await page.click('#didomi-notice-agree-button', { timeout: 5000 });
        log.info('[Warm-up] Consentimento RGPD aceite.');
        await humanDelay(800, 1500);
      } catch {
        log.debug('[Warm-up] Banner de consentimento não encontrado — continuando.');
      }

      // Scroll humano na homepage — simula comportamento de leitura real.
      await page.evaluate(() => {
        window.scrollBy(0, 400 + Math.random() * 200);
      });
      await humanDelay(4000, 8000);

      // Navegar para a categoria/província antes de ir para os listings.
      // Isto completa o padrão de navegação natural que o DataDome espera.
      const categoryUrl = `https://www.idealista.com/alquiler-viviendas/${slug}/`;
      log.info(`[Warm-up] A navegar para categoria: ${categoryUrl}`);
      await page.goto(categoryUrl, { waitUntil: 'networkidle' });
      await humanDelay(3000, 6000);

      // CAMADA 2 — Verificação crítica do cookie datadome.
      // Sem este cookie qualquer request a /inmueble/* ou /alquiler-viviendas/*
      // retorna 403 imediato independentemente de proxy ou fingerprint.
      const cookies = await page.context().cookies();
      const datadome = cookies.find((c) => c.name === 'datadome');

      if (!datadome) {
        session?.retire();
        throw new Error(
          '[Warm-up] Cookie datadome não foi emitido — IP ou sessão bloqueados na homepage. Sessão aposentada.',
        );
      }

      log.info(`[Warm-up] Cookie datadome obtido com sucesso (valor: ${datadome.value.slice(0, 20)}...)`);

      // Enfileirar os requests de listings AGORA — herdam a sessão com o cookie.
      // O crawlee mantém a mesma sessão (via SessionPool + persistCookiesPerSession)
      // para todos os requests enfileirados a partir deste ponto.
      const targetPage = (request.userData.targetPage as number) ?? 1;
      const listingUrl = buildUrl(targetPage);

      await requestQueue.addRequest({
        url: listingUrl,
        userData: { page: targetPage },
      });

      log.info(`[Warm-up] Aquecimento concluído. A enfileirar listing: ${listingUrl}`);
      return;
    }

    // -----------------------------------------------------------------------
    // Ramo de listings
    // -----------------------------------------------------------------------

    if (pushed >= maxResults) return;

    const currentPage = request.userData.page as number;

    // CAMADA 4 — Pausa após load antes de tocar no DOM.
    // DataDome monitoriza o intervalo entre o evento load e o primeiro evento JS.
    await page.waitForLoadState('domcontentloaded');
    await humanDelay(3000, 8000);

    // ------------------------------------------------------------------
    // Detecao de bloqueio DataDome (via texto além do status HTTP)
    // ------------------------------------------------------------------
    const currentUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');

    if (
      currentUrl.includes('/antibot/') ||
      bodyText.toLowerCase().includes('access denied') ||
      bodyText.toLowerCase().includes('datadome') ||
      bodyText.toLowerCase().includes('captcha')
    ) {
      log.warning(
        `[DataDome] BLOQUEADO (via texto) em ${request.url} (pagina ${currentPage}). ` +
          'Proxy RESIDENTIAL não foi suficiente. Considera integrar CapSolver para alta taxa de sucesso.',
      );
      session?.retire();
      return;
    }

    // CAMADA 4 — Scrolls incrementais antes de extrair os cards.
    // O DataDome monitoriza se o utilizador faz scroll antes de interagir com
    // o conteúdo — scroll imediato ao carregamento é sinal de bot.
    const scrollSteps = 2 + Math.floor(Math.random() * 2); // 2 ou 3 scrolls
    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = 300 + Math.floor(Math.random() * 200);
      await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollAmount);
      await humanDelay(600, 1200);
    }

    // ------------------------------------------------------------------
    // Aceitar cookies RGPD se aparecer novamente numa página de listing
    // (pode acontecer em sessões novas que não passaram pelo warm-up na homepage)
    // ------------------------------------------------------------------
    try {
      await page.click('#didomi-notice-agree-button', { timeout: 2000 });
      await humanDelay(500, 1000);
    } catch {
      // banner nao apareceu ou ja foi aceite — continua
    }

    // ------------------------------------------------------------------
    // Aguardar cards de imoveis
    // ------------------------------------------------------------------
    try {
      await page.waitForSelector('article.item', { timeout: 20000 });
    } catch {
      log.warning(
        `[Idealista] Nenhum card "article.item" encontrado em ${request.url} ` +
          `(pagina ${currentPage}). Possivel bloqueio ou sem resultados.`,
      );
      return;
    }

    // ------------------------------------------------------------------
    // Recolher todos os cards article.item da pagina
    // ------------------------------------------------------------------
    const cards = await page.$$('article.item');
    log.info(
      `[Idealista] Pagina ${currentPage}: ${cards.length} cards encontrados em ${request.url}`,
    );

    // CAMADA 3 — Sessão marcada como boa após cards encontrados com sucesso.
    session?.markGood();

    let pageCount = 0;

    for (const card of cards) {
      if (pushed >= maxResults) break;

      // Cada card tem try/catch independente — um card malformado nao rebenta o loop
      try {
        // ----------------------------------------------------------------
        // ID do anuncio (data-element-id no article.item)
        // ----------------------------------------------------------------
        const elementId = await card
          .evaluate((el) => el.getAttribute('data-element-id'))
          .catch(() => null);

        if (!elementId) {
          log.debug('[Idealista] Card sem data-element-id — ignorado.');
          continue;
        }

        // Dedup
        if (seenIds.has(elementId)) {
          log.debug(`[Idealista] ID ${elementId} ja processado — ignorado.`);
          continue;
        }

        // ----------------------------------------------------------------
        // URL do anuncio — construida sempre a partir do ID (href vem ofuscado)
        // ----------------------------------------------------------------
        const url = `https://www.idealista.com/inmueble/${elementId}/`;

        // ----------------------------------------------------------------
        // Titulo
        // ----------------------------------------------------------------
        const title = await safeText(card, ['a.item-link']) || null;

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
        const priceRaw = await safeText(card, ['span.item-price']);
        const price_total = toInt(priceRaw) ?? null;

        // ----------------------------------------------------------------
        // Quartos — lista .item-detail-char .item-detail, ex ["3 hab.","100 m²","..."]
        // Encontra o item que faz match /(\d+)\s*hab/i
        // ----------------------------------------------------------------
        let num_beds: number | null = null;
        try {
          const detailTexts = await card
            .$$eval('.item-detail-char .item-detail', (els) =>
              els.map((el) => el.textContent ?? ''),
            )
            .catch(() => [] as string[]);

          for (const detail of detailTexts) {
            const m = detail.match(/(\d+)\s*hab/i);
            if (m) {
              const parsed = parseInt(m[1], 10);
              if (Number.isFinite(parsed)) {
                num_beds = parsed;
                break;
              }
            }
          }
        } catch {
          num_beds = null;
        }

        // ----------------------------------------------------------------
        // Mobilia — default true; false se texto do card indicar sem mobilia
        // ----------------------------------------------------------------
        const cardText = await card.evaluate((el) => el.textContent ?? '').catch(() => '');
        const furnished = !/sin amueblar|sin muebles|sense moblar|unfurnished/i.test(cardText);

        // ----------------------------------------------------------------
        // Imagens — src com fallback data-src / data-lazy; filtra invalidas
        // ----------------------------------------------------------------
        let images: string[] = [];
        try {
          images = await card
            .$$eval('img', (els) =>
              (els as HTMLImageElement[])
                .map(
                  (img) =>
                    img.src ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy') ||
                    '',
                )
                .filter((src) => typeof src === 'string' && src.startsWith('http'))
                .slice(0, 6),
            )
            .catch(() => [] as string[]);
        } catch {
          images = [];
        }

        // ----------------------------------------------------------------
        // Filtros de negocio (minBeds e maxPricePerPerson)
        // ----------------------------------------------------------------
        if (num_beds !== null && num_beds < minBeds) {
          log.debug(`[Idealista] ID ${elementId} ignorado: ${num_beds} quartos < minBeds ${minBeds}`);
          continue;
        }

        if (
          price_total !== null &&
          num_beds !== null &&
          num_beds > 0 &&
          price_total / num_beds > maxPricePerPerson
        ) {
          log.debug(
            `[Idealista] ID ${elementId} ignorado: preco/pessoa ${Math.round(price_total / num_beds)}€ > maxPricePerPerson ${maxPricePerPerson}€`,
          );
          continue;
        }

        // ----------------------------------------------------------------
        // Push — shape exato esperado pelo app (NÃO ALTERAR)
        // ----------------------------------------------------------------
        await Actor.pushData({
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
          `[Idealista] Imovel #${pushed} (ID ${elementId}): ${title ?? 'sem titulo'} — ${price_total ?? '?'}€`,
        );

        // CAMADA 4 — Micro-delay entre cards com variação humana.
        await humanDelay(200, 700);

      } catch (err: unknown) {
        // Card malformado: regista e continua — nunca rebenta o loop
        const msg = err instanceof Error ? err.message : String(err);
        log.debug(`[Idealista] Erro a processar card — ignorado. Detalhe: ${msg}`);
      }
    }

    log.info(
      `[Idealista] Pagina ${currentPage} concluida: ${pageCount} imoveis adicionados (total: ${pushed}/${maxResults})`,
    );

    // ------------------------------------------------------------------
    // Paginacao — seletor validado: a.icon-arrow-right-after
    // Fallback: .pagination li.next a
    // Fallback final: constroi /pagina-N.htm
    // ------------------------------------------------------------------
    if (pushed >= maxResults) return;

    const nextPage = currentPage + 1;

    // Tenta extrair href do botao "proxima pagina"
    let nextUrl: string | null = null;

    try {
      const nextEl = await page.$('a.icon-arrow-right-after, .pagination li.next a');
      if (nextEl) {
        const href = await nextEl.getAttribute('href').catch(() => null);
        if (href) {
          nextUrl = new URL(href, 'https://www.idealista.com').href;
        }
      }
    } catch {
      // seletor falhou — usa fallback abaixo
    }

    // Fallback: constroi URL de paginacao manualmente
    if (!nextUrl) {
      // Verifica se esta na pagina de listagem (nao numa pagina "sem resultados")
      const hasResults = await page.$('article.item').then((el) => el !== null).catch(() => false);
      if (hasResults && cards.length > 0) {
        nextUrl = buildUrl(nextPage);
        log.debug(`[Idealista] Paginacao por fallback: ${nextUrl}`);
      }
    }

    if (nextUrl) {
      // CAMADA 4 — Pausa maior entre páginas para simular tempo de leitura humano.
      await humanDelay(3000, 8000);
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
