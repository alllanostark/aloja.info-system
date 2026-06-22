# Sparks Aloja - Habitaclia Scraper

Ator Apify que recolhe anuncios de aluguer residencial do Habitaclia.com para o projeto Sparks Aloja.

---

## O que faz

Percorre as paginas de listagem de `/alquiler-<slug>.htm` no Habitaclia, extrai dados de cada card e filtra por numero minimo de quartos e preco maximo por pessoa. Usa `CheerioCrawler` (HTTP puro, sem browser headless) — rapido e barato em compute units.

---

## Contrato de input

| Campo | Tipo | Obrigatorio | Default | Descricao |
|-------|------|-------------|---------|-----------|
| `location` | string | sim | - | Cidade (ex: `"Tarragona, Spain"`) |
| `maxResults` | integer | nao | 25 | Limite de imoveis a devolver |
| `minBeds` | integer | nao | 1 | Minimo de quartos |
| `maxPricePerPerson` | integer | nao | 450 | Preco/pessoa/mes em euros |

---

## Contrato de output (Dataset)

Cada item do dataset tem exactamente estas chaves:

```json
{
  "title": "Piso en alquiler en Tarragona",
  "address": "Tarragona, Tarragones",
  "price_total": 750,
  "num_beds": 3,
  "furnished": true,
  "url": "https://www.habitaclia.com/alquiler-piso-...",
  "platform": "habitaclia",
  "images": ["https://...jpg"],
  "lat": null,
  "lng": null
}
```

Nota: `lat`/`lng` sao sempre `null` nesta versao — Habitaclia nao expoe coordenadas no HTML das listagens. Para obter coords seria necessario visitar a pagina de detalhe de cada imovel (custo extra de requests).

---

## Deploy no Apify Cloud

```bash
npm i -g apify-cli
apify login          # pede o token da conta Apify
cd apify-actors/habitaclia
apify push
```

O Apify Cloud usa o `Dockerfile` para compilar o TypeScript — nao e necessario fazer build localmente.

---

## Variavel de ambiente na app

Apos o deploy, o ator fica disponivel como `<username>/sparks-aloja-habitaclia`. Adiciona ao `.env` da app:

```
APIFY_ACTOR_HABITACLIA=<username>/sparks-aloja-habitaclia
```

---

## Configuracao de proxy

O ator inicia com `DATACENTER` proxy (mais barato). Se o Habitaclia comecar a devolver CAPTCHAs ou respostas vazias:

1. Abre o codigo em `src/main.ts`
2. Muda `groups: ['DATACENTER']` para `groups: ['RESIDENTIAL']`
3. Faz novo `apify push`

Proxies residenciais custam mais unidades Apify mas contornam rate-limiting.

---

## Riscos conhecidos

- **Seletores frageis**: Habitaclia redesenha o front-end periodicamente. Todos os seletores CSS estao marcados com `// TODO: verificar contra DOM ao vivo`. Se o scraper devolver 0 resultados, inspecciona o HTML de `https://www.habitaclia.com/alquiler-tarragona.htm` e actualiza os seletores.
- **Anti-bot**: Habitaclia usa Cloudflare. CheerioCrawler pode ser bloqueado sem proxy residencial em producao com volume alto.
- **Paginacao**: o seletor de "pagina seguinte" pode mudar. Verifica `a[rel="next"]` no DOM.
- **Lat/lng**: coordenadas nao estao disponiveis nas listagens — ficam a `null`.
- **Preco por pessoa**: a divisao `price_total / num_beds` e uma aproximacao; o preco real por pessoa depende de cusas suplementares (agua, luz, etc.) que nao estao nos cards.
