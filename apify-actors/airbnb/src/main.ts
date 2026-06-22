import { Actor } from 'apify';
import { PlaywrightCrawler, log, RequestQueue } from 'crawlee';

// AVISO DE ANTI-BOT: Airbnb usa um sistema proprietário de deteção de bots.
// A estrutura da página é gerada por React com dados injetados via __NEXT_DATA__ (JSON no <script>).
// A estratégia mais fiável é extrair o JSON inline em vez de fazer scraping do DOM visual,
// pois os nomes de classes CSS são hashed e mudam frequentemente (CSS modules).
// Mesmo assim, Airbnb deteta headless via análise de comportamento JS e pode retornar
// resultados vazios ou redirects sem dar erro HTTP explícito (shadow blocking).
// Para estadias mensais (workcations/relocação) a busca usa o parâmetro monthly_length.

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

const PLATFORM = 'airbnb';

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

// Airbnb aceita localização em texto livre no query param "query"

const toInt = (s?: string | null): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const humanDelay = (min = 600, max = 2000) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'ES',
});

let pushed = 0;

// URL de busca Airbnb para estadias mensais (28+ dias = preços mensais)
// tab_id=home_tab, flexible_trip_lengths=one_month, monthly_length=1
// TODO: verificar parâmetros contra a URL gerada pelo site ao vivo — Airbnb muda query params com frequência
const buildUrl = (cursor?: string) => {
  const base = new URL('https://www.airbnb.es/s/homes');
  base.searchParams.set('query', location);
  base.searchParams.set('flexible_trip_lengths[]', 'one_month');
  base.searchParams.set('monthly_length', '1');
  base.searchParams.set('price_filter_input_type', '2'); // preço por mês
  base.searchParams.set('search_type', 'filter_change');
  base.searchParams.set('tab_id', 'home_tab');
  // Quartos mínimos
  if (minBeds > 1) {
    base.searchParams.set('min_bedrooms', String(minBeds));
  }
  // Preço máximo total (Airbnb não tem filtro por pessoa, só total)
  if (maxPricePerPerson > 0) {
    base.searchParams.set('price_max', String(maxPricePerPerson * 4)); // estimativa 4 pessoas
  }
  if (cursor) {
    base.searchParams.set('cursor', cursor);
  }
  return base.toString();
};

const requestQueue = await RequestQueue.open();
await requestQueue.addRequest({ url: buildUrl(), userData: { page: 1 } });

const crawler = new PlaywrightCrawler({
  proxyConfiguration,
  requestQueue,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 150,
  navigationTimeoutSecs: 90,
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
      headless: true,
    },
  },

  async requestHandler({ page, request }) {
    if (pushed >= maxResults) return;

    await page.waitForLoadState('domcontentloaded');
    await humanDelay(1500, 3500);

    // Aceitar cookies RGPD — Airbnb usa modal próprio
    // TODO: verificar seletor contra DOM ao vivo
    try {
      await page.click('button[data-testid="accept-btn"]', { timeout: 6000 });
      await humanDelay();
    } catch {
      // sem modal, continua
    }

    // --- ESTRATÉGIA 1: Extrair __NEXT_DATA__ (mais fiável que scraping DOM) ---
    // Airbnb injeta todos os listings no JSON do Next.js antes do hydrate
    let extractedFromJson = false;

    try {
      const nextData = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try {
          return JSON.parse(el.textContent ?? '');
        } catch {
          return null;
        }
      });

      if (nextData) {
        // O caminho exato dentro do JSON muda entre versões do Airbnb
        // TODO: inspecionar __NEXT_DATA__ ao vivo para confirmar o caminho correto
        // Caminhos comuns observados em 2024-2025:
        // props.pageProps.staysSearch.results.stayListings
        // props.pageProps.searchResults.stayResults
        const stayListings: Array<Record<string, unknown>> =
          nextData?.props?.pageProps?.staysSearch?.results?.stayListings ??
          nextData?.props?.pageProps?.searchResults?.stayResults ??
          [];

        if (stayListings.length > 0) {
          log.info(`Airbnb: ${stayListings.length} listings encontrados via __NEXT_DATA__`);
          extractedFromJson = true;

          for (const listing of stayListings) {
            if (pushed >= maxResults) break;

            // TODO: verificar estrutura exata do objeto listing contra __NEXT_DATA__ ao vivo
            const id = (listing as Record<string, unknown>).id ?? (listing as Record<string, unknown>).listingId;
            const name = (listing as Record<string, unknown>).name ?? (listing as Record<string, unknown>).title ?? null;
            const city = (listing as Record<string, unknown>).city ?? null;
            const pricingObj = (listing as Record<string, unknown>).pricing ?? (listing as Record<string, unknown>).priceDisplayLabel ?? {};
            const priceRaw = typeof pricingObj === 'string' ? pricingObj : JSON.stringify(pricingObj);
            const price_total = toInt(priceRaw);

            const bedsRaw = String((listing as Record<string, unknown>).bedrooms ?? '');
            const num_beds = toInt(bedsRaw);

            const imgList = ((listing as Record<string, unknown>).contextualPictures ?? (listing as Record<string, unknown>).pictures ?? []) as Array<{ picture?: string; url?: string }>;
            const images = imgList
              .map((p) => p.picture ?? p.url ?? '')
              .filter(Boolean)
              .slice(0, 6);

            const url = id
              ? `https://www.airbnb.es/rooms/${id}`
              : request.loadedUrl!;

            const cardText = JSON.stringify(listing);
            const furnished = !/sem mobília|unfurnished/i.test(cardText); // Airbnb é sempre mobilado

            if (num_beds !== null && num_beds < minBeds) continue;
            if (price_total !== null && num_beds !== null && price_total / num_beds > maxPricePerPerson) continue;

            await Actor.pushData({
              title: typeof name === 'string' ? name : null,
              address: typeof city === 'string' ? city : null,
              price_total,
              num_beds,
              furnished,
              url,
              platform: PLATFORM,
              images,
              lat: null,
              lng: null,
            });

            pushed++;
            log.debug(`Airbnb: imóvel #${pushed} adicionado via JSON — ${name}`);
          }

          // Paginação via cursor (Airbnb usa cursor-based pagination)
          // TODO: verificar caminho do cursor no __NEXT_DATA__ ao vivo
          if (pushed < maxResults) {
            const nextCursor: string | null =
              nextData?.props?.pageProps?.staysSearch?.results?.paginationInfo?.nextCursor ?? null;
            if (nextCursor) {
              await requestQueue.addRequest({
                url: buildUrl(nextCursor),
                userData: { page: (request.userData.page as number) + 1 },
              });
            }
          }
        }
      }
    } catch (jsonErr) {
      log.warning(`Airbnb: falha ao extrair __NEXT_DATA__: ${jsonErr}`);
    }

    // --- ESTRATÉGIA 2: Fallback DOM (menos fiável — classes hashed mudam) ---
    if (!extractedFromJson) {
      log.warning('Airbnb: __NEXT_DATA__ não encontrado ou vazio. A tentar scraping DOM (frágil).');

      // Aguardar cards de propriedade
      // TODO: verificar seletor contra DOM ao vivo — Airbnb usa data-testid que muda com versões
      try {
        await page.waitForSelector('[data-testid="card-container"], div[itemprop="itemListElement"]', {
          timeout: 25000,
        });
      } catch {
        log.warning(`Airbnb: nenhum card encontrado via DOM em ${request.url}. Possível bloqueio ou shadow-blocking.`);
        return;
      }

      // TODO: verificar seletor contra DOM ao vivo
      const cards = await page.$$('[data-testid="card-container"]');
      log.info(`Airbnb: ${cards.length} cards DOM encontrados`);

      for (const card of cards) {
        if (pushed >= maxResults) break;

        const txt = async (sel: string): Promise<string> =>
          (await card.$eval(sel, (e) => e.textContent ?? '').catch(() => '')) || '';

        // TODO: verificar seletores contra DOM ao vivo — todos os data-testid podem mudar
        const title = (await txt('[data-testid="listing-card-title"]')).trim() || null;
        const priceRaw = await txt('[data-testid="price-availability-row"] span, span[class*="price"]');
        const price_total = toInt(priceRaw);

        // Airbnb não mostra quartos diretamente no card — vem na subtitle
        // TODO: verificar seletor contra DOM ao vivo
        const subtitleRaw = await txt('[data-testid="listing-card-subtitle"]');
        const bedsMatch = subtitleRaw.match(/(\d+)\s*(hab|quart|bed|room)/i);
        const num_beds = bedsMatch ? parseInt(bedsMatch[1], 10) : null;

        // Airbnb não mostra morada — só cidade/zona na subtitle
        const address = (await txt('[data-testid="listing-card-subtitle"]')).split('·')[0].trim() || null;

        const href = await card
          .$eval('a', (e) => (e as HTMLAnchorElement).href)
          .catch(() => '');
        const url = href ? new URL(href, 'https://www.airbnb.es').href : request.loadedUrl!;

        const images = await card
          .$$eval('img', (els) =>
            els
              .map((i) => (i as HTMLImageElement).src || i.getAttribute('data-src') || '')
              .filter(Boolean)
              .slice(0, 6),
          )
          .catch(() => [] as string[]);

        const furnished = true; // Airbnb é sempre mobilado por definição

        if (num_beds !== null && num_beds < minBeds) continue;
        if (price_total !== null && num_beds !== null && price_total / num_beds > maxPricePerPerson) continue;

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

        pushed++;
        log.debug(`Airbnb: imóvel #${pushed} adicionado via DOM — ${title}`);
        await humanDelay(300, 800);
      }
    }
  },
});

await crawler.run();
log.info(`Airbnb: scraping concluído. ${pushed} imóveis recolhidos.`);
await Actor.exit();
