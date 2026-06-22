import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';

/**
 * AVISO IMPORTANTE — MODELO DE NEGOCIO HOMYSPACE
 *
 * Homyspace (homyspace.com) e uma plataforma B2B de alojamento temporario para empresas.
 * O seu modelo e "orcamento sob pedido": o utilizador submete datas, localizacao e numero
 * de pessoas e recebe propostas de alojamentos parceiros — NAO ha grelha publica de imoveis
 * com precos indexaveis.
 *
 * Isso significa:
 *  - NAO existe uma URL de listagem paginada com cards de imoveis e precos visiveis.
 *  - O HTML publico contem apenas landing pages, formularios de contacto e blog.
 *  - Os dados reais de alojamento estao atras de autenticacao e/ou sao devolvidos via
 *    API privada apos submissao do formulario de orcamento.
 *
 * Este ator faz best-effort: tenta encontrar qualquer grelha de imoveis publicamente
 * acessivel. Na pratica vai devolver 0 resultados enquanto o site mantiver este modelo.
 * O ator NAO vai falhar — termina limpo com 0 items e loga o aviso.
 *
 * Alternativas recomendadas se Homyspace for essencial:
 *  1. Contactar Homyspace para obter acesso a API parceiro (preferido — dados limpos).
 *  2. Substituir por Spotahome, Uniplaces ou Badi que tem listagens publicas.
 *  3. Usar PlaywrightCrawler (browser headless) para preencher o formulario e capturar
 *     a resposta — mas isso requer conta registada e viola os ToS.
 */

interface Input {
  location: string;
  maxResults?: number;
  minBeds?: number;
  maxPricePerPerson?: number;
}

const PLATFORM = 'homyspace';

await Actor.init();

const {
  location,
  maxResults = 25,
  minBeds = 1,
  maxPricePerPerson = 450,
} = (await Actor.getInput<Input>()) ?? { location: '' };

if (!location) {
  log.error('Input "location" e obrigatorio.');
  await Actor.exit({ exitCode: 1 });
}

log.warning(
  'AVISO: Homyspace e um site B2B de orcamento sob pedido. ' +
    'Nao ha listagens publicas com precos. Este ator pode devolver 0 resultados. ' +
    'Ver README para alternativas.'
);

const slug = location
  .split(',')[0]
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, '-');

const toInt = (s?: string | null): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['DATACENTER'],
});

let pushed = 0;

const crawler = new CheerioCrawler({
  proxyConfiguration,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 60,

  async requestHandler({ $, request, enqueueLinks }) {
    if (pushed >= maxResults) return;

    log.info(`A processar: ${request.url} (label=${request.label})`);

    // TODO: verificar seletores contra DOM ao vivo
    // Homyspace pode ter uma secao de "alojamentos disponiveis" ou "habitaciones"
    // em certas paginas de cidade. Tentamos varios seletores genericos.
    const cards = $(
      [
        // Tentativas de seletores genericos para cards de alojamento
        'article[class*="property"]', // TODO: verificar contra DOM ao vivo
        'div[class*="listing-item"]', // TODO: verificar contra DOM ao vivo
        'div[class*="accommodation"]', // TODO: verificar contra DOM ao vivo
        'div[class*="alojamiento"]', // TODO: verificar contra DOM ao vivo
        'div[class*="habitacion"]', // TODO: verificar contra DOM ao vivo
        'li[class*="property"]', // TODO: verificar contra DOM ao vivo
        '.property-card', // TODO: verificar contra DOM ao vivo
      ].join(', ')
    );

    if (cards.length === 0) {
      log.info(
        `Nenhum card encontrado em ${request.url}. ` +
          'Homyspace provavelmente nao tem listagens publicas nesta pagina — comportamento esperado.'
      );
      return;
    }

    cards.each((_, el) => {
      if (pushed >= maxResults) return;

      const card = $(el);

      const title =
        card.find('h2, h3, [class*="title"], [class*="name"]').first().text().trim() || null; // TODO: verificar contra DOM ao vivo

      const rawHref = card.find('a').first().attr('href') ?? '';
      const url = rawHref
        ? new URL(rawHref, 'https://www.homyspace.com').href
        : request.loadedUrl;

      const priceRaw = card
        .find('[class*="price"], [class*="precio"], [class*="rate"]') // TODO: verificar contra DOM ao vivo
        .first()
        .text();
      const price_total = toInt(priceRaw);

      const bedsRaw = card
        .find('[class*="hab"], [class*="room"], [class*="bedroom"]') // TODO: verificar contra DOM ao vivo
        .first()
        .text();
      const num_beds = toInt(bedsRaw);

      const address =
        card.find('[class*="location"], [class*="address"], [class*="ciudad"]') // TODO: verificar contra DOM ao vivo
          .first()
          .text()
          .trim() || null;

      const cardText = card.text();
      const furnished = !/sin amueblar|sense mobles|sin muebles/i.test(cardText);

      const images = card
        .find('img')
        .map((_, img) => $(img).attr('data-src') ?? $(img).attr('src') ?? '')
        .get()
        .filter((src) => src.startsWith('http'))
        .slice(0, 6);

      if (num_beds != null && num_beds < minBeds) return;
      if (
        price_total != null &&
        num_beds != null &&
        num_beds > 0 &&
        price_total / num_beds > maxPricePerPerson
      )
        return;

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

      pushed++;
    });

    if (pushed < maxResults) {
      await enqueueLinks({
        selector: 'a[rel="next"], a[class*="next"], a[aria-label*="siguiente"]', // TODO: verificar contra DOM ao vivo
        label: 'LIST',
      });
    }
  },
});

// URLs candidatas a ter listagens publicas no Homyspace
// Nenhuma destas e garantida — o site pode redirecionar para formulario de contacto
const candidateUrls = [
  `https://www.homyspace.com/alojamiento/${slug}`, // TODO: verificar se esta URL existe
  `https://www.homyspace.com/habitaciones/${slug}`, // TODO: verificar se esta URL existe
  `https://www.homyspace.com/pisos/${slug}`, // TODO: verificar se esta URL existe
];

log.info(`${PLATFORM}: a tentar ${candidateUrls.length} URLs candidatas para "${location}"`);
await crawler.run(candidateUrls.map((url) => ({ url, label: 'LIST' })));
log.info(
  `${PLATFORM}: ${pushed} imoveis recolhidos. ` +
    (pushed === 0
      ? 'ESPERADO: Homyspace nao tem listagens publicas indexaveis.'
      : 'Dados recolhidos com sucesso.')
);

await Actor.exit();
