# sparks-aloja-spotahome

Apify actor que extrai imóveis de aluguer mensal mobilado do Spotahome para Espanha.
Faz parte do projecto Sparks Aloja (ferramenta interna de busca de alojamento para trabalhadores do Grupo PF).

## O que faz

1. Abre a página de listagem do Spotahome para a cidade pedida.
2. Tenta extrair dados do `<script id="__NEXT_DATA__">` (estratégia principal — mais estável que seletores CSS).
3. Se o JSON estiver vazio ou o caminho mudar, faz fallback para scraping DOM com PlaywrightCrawler.
4. Aplica os filtros de negócio (minBeds, maxPricePerPerson).
5. Pagina automaticamente até atingir maxResults.
6. Devolve os imóveis com exactamente 10 campos no dataset do Apify.

## Input

```json
{
  "location": "Barcelona, Spain",
  "maxResults": 25,
  "minBeds": 1,
  "maxPricePerPerson": 450
}
```

| Campo | Tipo | Obrigatorio | Default | Descricao |
|---|---|---|---|---|
| location | string | sim | - | Cidade (ex: "Tarragona, Spain"). Tudo depois da virgula e ignorado. |
| maxResults | integer | nao | 25 | Maximo de imoveis a recolher |
| minBeds | integer | nao | 1 | Minimo de quartos — descarta abaixo deste valor |
| maxPricePerPerson | integer | nao | 450 | Maximo euros/pessoa/mes — descarta se price_total/num_beds ultrapassar |

## Output (por item no dataset)

```json
{
  "title": "Habitacion en piso compartido cerca del metro",
  "address": "Gracia, Barcelona",
  "price_total": 850,
  "num_beds": 3,
  "furnished": true,
  "url": "https://www.spotahome.com/en/accommodation/...",
  "platform": "spotahome",
  "images": ["https://cdn.spotahome.com/..."],
  "lat": 41.403,
  "lng": 2.174
}
```

Spotahome e por definicao aluguer mensal mobilado — `furnished` e sempre `true` salvo campo explicito no JSON dizer o contrario.
Coordenadas (lat/lng) estao normalmente disponiveis no `__NEXT_DATA__` do Spotahome.

## Deploy

```bash
cd /Users/marciolemossantos/sparks-aloja/apify-actors/spotahome
apify push
```

O build acontece no Apify Cloud (imagem `apify/actor-node-playwright-chrome:20`). Nao correr `npm install` localmente.

## Proxy

Usa proxy RESIDENTIAL ES (configurado via `Actor.createProxyConfiguration`).
Obrigatorio — Spotahome bloqueia IPs datacenter facilmente.
Certifica que o plano Apify tem creditos de proxy RESIDENTIAL antes de correr.

## Variavel de ambiente

Guarda o actor ID depois do primeiro `apify push` e regista em `.env`:

```
APIFY_ACTOR_SPOTAHOME=<actor-id-aqui>
```

Usado pelo orquestrador do Sparks Aloja para invocar este actor via API.

## Aviso de fragilidade

- O caminho dentro do `__NEXT_DATA__` (`props.pageProps.initialState.listings.items` ou similar) muda sempre que o Spotahome faz um refactor do Next.js. Quando o actor comecar a devolver 0 resultados sem erro, o primeiro passo e abrir o browser, fazer F12, ir ao HTML e reler o JSON do `__NEXT_DATA__` para encontrar o novo caminho.
- Todos os seletores CSS do fallback DOM estao marcados com `// TODO: verificar contra DOM ao vivo` — sao estimativas baseadas em padroes Next.js tipicos, nao inspecao real do DOM actual.
- O padrao de slug `--spain` (ex: `barcelona--spain`) pode mudar. Verificar URL ao vivo se a pagina devolver 404.
- Anti-bot: Spotahome tem proteccao moderada. Proxy RESIDENTIAL + fingerprints do Crawlee devem ser suficientes, mas pode exigir ajuste de `navigationTimeoutSecs` em periodos de alta carga.
