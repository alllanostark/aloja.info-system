# sparks-aloja-uniplaces

Apify actor que extrai imóveis de aluguer mensal mobilado do Uniplaces para Espanha.
Faz parte do projecto Sparks Aloja (ferramenta interna de busca de alojamento para trabalhadores do Grupo PF).

## O que faz

1. Abre a página de listagem do Uniplaces para a cidade pedida.
2. Tenta extrair dados do `<script id="__NEXT_DATA__">` (estratégia principal — mais estável que seletores CSS).
3. Se o JSON estiver vazio ou o caminho mudar, faz fallback para scraping DOM com PlaywrightCrawler.
4. Aplica os filtros de negócio (minBeds, maxPricePerPerson).
5. Detecta se o anuncio e quarto individual (type="room") e atribui num_beds=1 nesses casos.
6. Pagina automaticamente até atingir maxResults.
7. Devolve os imóveis com exactamente 10 campos no dataset do Apify.

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
| location | string | sim | - | Cidade (ex: "Barcelona, Spain"). Tudo depois da virgula e ignorado. |
| maxResults | integer | nao | 25 | Maximo de imoveis a recolher |
| minBeds | integer | nao | 1 | Minimo de quartos — descarta abaixo deste valor |
| maxPricePerPerson | integer | nao | 450 | Maximo euros/pessoa/mes — descarta se price_total/num_beds ultrapassar |

## Output (por item no dataset)

```json
{
  "title": "Double room in shared flat - Poblenou",
  "address": "Poblenou, Barcelona",
  "price_total": 650,
  "num_beds": 1,
  "furnished": true,
  "url": "https://www.uniplaces.com/en/accommodation/barcelona/...",
  "platform": "uniplaces",
  "images": ["https://assets.uniplaces.com/..."],
  "lat": 41.401,
  "lng": 2.195
}
```

Nota sobre `num_beds`: Uniplaces lista tanto quartos individuais como apartamentos inteiros.
Para quartos individuais (detectados pelo campo `type` contendo "room"), o actor devolve `num_beds: 1`.
Para apartamentos, usa o campo `bedrooms`/`rooms` do JSON (fallback: 1).

## Deploy

```bash
cd /Users/marciolemossantos/sparks-aloja/apify-actors/uniplaces
apify push
```

O build acontece no Apify Cloud (imagem `apify/actor-node-playwright-chrome:20`). Nao correr `npm install` localmente.

## Proxy

Usa proxy RESIDENTIAL ES (configurado via `Actor.createProxyConfiguration`).
Uniplaces tem proteccao moderada — proxy RESIDENTIAL e necessario para evitar bloqueios consistentes.
Certifica que o plano Apify tem creditos de proxy RESIDENTIAL antes de correr.

## Variavel de ambiente

Guarda o actor ID depois do primeiro `apify push` e regista em `.env`:

```
APIFY_ACTOR_UNIPLACES=<actor-id-aqui>
```

Usado pelo orquestrador do Sparks Aloja para invocar este actor via API.

## Aviso de fragilidade

- O caminho dentro do `__NEXT_DATA__` e o maior risco. Uniplaces usa Next.js mas a estrutura de `pageProps` muda frequentemente. Caminhos tentados: `initialData.properties`, `initialData.accommodations`, `initialData.listings`, `properties`, `accommodations`. Quando o actor devolver 0 resultados, abrir o browser e reler o JSON do `__NEXT_DATA__` para encontrar o caminho actual.
- Todos os seletores CSS do fallback DOM estao marcados com `// TODO: verificar contra DOM ao vivo` — sao estimativas, nao inspecao real.
- O Uniplaces tem menos stock em Espanha fora de Barcelona e Madrid. Para cidades pequenas como Tarragona espera resultados escassos ou zero.
- Anti-bot: nivel moderado, semelhante ao Spotahome. Proxy RESIDENTIAL + fingerprints Crawlee devem ser suficientes.
- Distincao quarto/apartamento: a logica `isRoomListing` baseia-se no campo `type`/`propertyType`/`category`. Se estes campos nao existirem no JSON, o actor assume `num_beds: 1` para toda a listagem, o que pode sub-reportar apartamentos inteiros.
