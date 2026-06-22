# Sparks Aloja - Milanuncios Scraper

Ator Apify que recolhe anuncios de aluguer de pisos no Milanuncios.com para o projeto Sparks Aloja.

---

## O que faz

Percorre as paginas de listagem de `/alquiler-de-pisos-en-<slug>/` no Milanuncios, extrai dados de cada card e aplica filtros de quartos e preco por pessoa. Usa `CheerioCrawler` (HTTP puro).

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

```json
{
  "title": "Piso en alquiler en Tarragona",
  "address": "Tarragona, Tarragones",
  "price_total": 650,
  "num_beds": 2,
  "furnished": false,
  "url": "https://www.milanuncios.com/anuncio/...",
  "platform": "milanuncios",
  "images": ["https://...jpg"],
  "lat": null,
  "lng": null
}
```

Nota: `num_beds` pode ser `null` em muitos anuncios — Milanuncios e um classificado livre e os anunciantes nem sempre preenchem o numero de quartos no card da listagem. A filtragem por `minBeds` so actua quando o valor existe.

---

## Deploy no Apify Cloud

```bash
npm i -g apify-cli
apify login
cd apify-actors/milanuncios
apify push
```

---

## Variavel de ambiente na app

```
APIFY_ACTOR_MILANUNCIOS=<username>/sparks-aloja-milanuncios
```

---

## Configuracao de proxy

Comecar com `DATACENTER`. Se surgirem respostas 403 ou paginas em branco:

1. Mudar `groups: ['DATACENTER']` para `groups: ['RESIDENTIAL']` em `src/main.ts`
2. `apify push`

---

## Riscos conhecidos

- **Seletores muito frageis**: Milanuncios pertence ao grupo Adevinta e tem frontend com classes geradas (ex: `ma-AdCard-titleLink`) que mudam frequentemente sem aviso. E o site mais propenso a partir dos tres. Todos os seletores marcados com `// TODO`.
- **num_beds ausente**: classificados livres raramente incluem o campo de quartos no card de listagem — esperar muitos `null`. A filtragem por quartos fica comprometida para estes casos.
- **Anti-bot moderado**: Adevinta usa Cloudflare e fingerprinting. Com volume alto (>100 requests) e proxy DATACENTER e provavel throttling ou CAPTCHA.
- **URL de categoria**: a estrutura `/alquiler-de-pisos-en-<slug>/` funciona para pisos. Para outros tipos (casas, estudios) a URL muda — o ator nao cobre esses casos nesta versao.
- **Lat/lng**: nao disponiveis nas listagens.
- **Qualidade dos dados**: Milanuncios e um classificado aberto; precos e descricoes sao inseridos manualmente pelos anunciantes com menos rigor do que Habitaclia ou Idealista.
