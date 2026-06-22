# Sparks Aloja - Idealista Scraper

Ator Apify que recolhe anúncios de arrendamento residencial do Idealista.com para o projeto Sparks Aloja (Grupo PF).

## AVISO CRITICO: Anti-bot DataDome

O Idealista usa DataDome — um dos sistemas anti-bot de nível empresarial mais agressivos do mercado, utilizado também por sites como leboncoin, Rakuten, Glassdoor.

O DataDome analisa em tempo real:
- Fingerprint TLS (JA3/JA4 hash da handshake TLS)
- Comportamento do rato e teclado (timing, aceleração, padrão de movimento)
- Eventos JS assíncronos (requestAnimationFrame timing, performance.now() drift)
- Headers HTTP/2 e QUIC
- Padrão de navegação (ordem dos pedidos, timings)
- Heurísticas de headless browser (mesmo com fingerprints reais)

**Taxa de sucesso estimada com apenas proxy RESIDENTIAL + Crawlee fingerprints: 30-50%.** O bloqueio é frequentemente silencioso — o site retorna resultados vazios ou redireciona sem dar erro HTTP explícito.

Para uma solucao robusta seria necessário adicionar:
- Servico anti-CAPTCHA (CapSolver, 2captcha, NoCaptchaAI) — ~$3-10/1000 solucoes
- Ou usar a API oficial do Idealista (requer aprovacao e tem quota limitada)

**Custo estimado para scraping fiavel do Idealista: $50-200/mes em proxies + anti-CAPTCHA.**

## O que faz

Tenta navegar nas listagens de aluguer do Idealista para uma dada localização. O ator detecta bloqueios DataDome explicitamente e loga um aviso claro em vez de falhar silenciosamente.

## Contrato de Input

```json
{
  "location": "Tarragona, Spain",
  "maxResults": 25,
  "minBeds": 2,
  "maxPricePerPerson": 400
}
```

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|-------------|---------|-----------|
| `location` | string | sim | - | Cidade ou morada. Ex: "Tarragona" ou "Barcelona" |
| `maxResults` | integer | não | 25 | Máximo de imóveis a recolher |
| `minBeds` | integer | não | 1 | Quartos mínimos |
| `maxPricePerPerson` | integer | não | 450 | Filtro: preço total / num_beds <= este valor |

## Contrato de Output (dataset)

```json
{
  "title": "Piso en alquiler en Tarragona",
  "address": "Centro, Tarragona",
  "price_total": 750,
  "num_beds": 3,
  "furnished": true,
  "url": "https://www.idealista.com/inmueble/...",
  "platform": "idealista",
  "images": ["https://img3.idealista.com/...", "..."],
  "lat": null,
  "lng": null
}
```

## Deploy no Apify Cloud

```bash
cd apify-actors/idealista
apify push
```

Variavel de ambiente na app:

```
APIFY_ACTOR_IDEALISTA=<username>/sparks-aloja-idealista
```

## Alternativa recomendada: API oficial do Idealista

O Idealista tem API REST oficial para parceiros:
- Endpoint: `https://api.idealista.com/3.5/es/search`
- Requer registo em `developers.idealista.com`
- Quota gratuita: ~100 chamadas/mes (insuficiente para producao)
- Quota paga: contactar sales

Se o volume de pesquisas do Sparks Aloja crescer, a API oficial é mais fiável e economicamente mais eficiente do que manter um scraper contra DataDome.

## Seletores - Estado Actual

O Idealista usa HTML server-side rendering com classes CSS semanticas relativamente estaveis (`.item`, `.item-price`, `.item-link`). Menor risco de quebra por deploy de frontend do que sites SPA. Os seletores marcados com `// TODO` foram escritos com base na estrutura observada em 2025 mas devem ser verificados antes de producao.

## Riscos conhecidos

- DataDome pode bloquear mesmo com proxy RESIDENTIAL (30-50% de taxa de bloqueio)
- O ator detecta bloqueios e loga aviso — não retorna dados falsos
- Paginacao pode ser interrompida por bloqueio em paginas intermédias
- Delays humanizados aumentam o tempo de execucao mas reduzem bloqueios
- Custo de proxy RESIDENTIAL no Apify varia com o volume — monitorizar em console.apify.com
