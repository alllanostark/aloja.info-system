# Sparks Aloja - Fotocasa Scraper

Ator Apify que recolhe anúncios de arrendamento residencial do Fotocasa.es para o projeto Sparks Aloja (Grupo PF).

## O que faz

Navega nas listagens de aluguer do Fotocasa para uma dada localização, extrai dados de cada anúncio e publica no dataset do Apify. Suporta paginação automática até atingir `maxResults`.

Anti-bot do Fotocasa: moderado. Usa protecoes basicas de JS (verificação de User-Agent, analise de headers). Com proxy RESIDENTIAL + fingerprints reais do Crawlee, a taxa de sucesso é alta (~80-90%), mas pode cair se o Fotocasa actualizar as defesas. Não usa DataDome nem sistemas de nível empresarial.

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
| `location` | string | sim | - | Cidade ou morada. Só a primeira parte (antes da virgula) é usada como slug. Ex: "Tarragona" |
| `maxResults` | integer | não | 25 | Máximo de imóveis a recolher |
| `minBeds` | integer | não | 1 | Quartos mínimos (filtra no scraper) |
| `maxPricePerPerson` | integer | não | 450 | Filtro: preço total / num_beds <= este valor |

## Contrato de Output (dataset)

Cada item publicado tem exactamente estas chaves:

```json
{
  "title": "Piso en alquiler en Tarragona",
  "address": "Eixample, Tarragona",
  "price_total": 850,
  "num_beds": 3,
  "furnished": true,
  "url": "https://www.fotocasa.es/es/alquiler/vivienda/...",
  "platform": "fotocasa",
  "images": ["https://img.fotocasa.es/...", "..."],
  "lat": null,
  "lng": null
}
```

Campos `lat` e `lng` são sempre `null` nesta versão — o Fotocasa não expõe coordenadas no DOM do card.

## Deploy no Apify Cloud

```bash
# Instalar Apify CLI se necessário
npm install -g apify-cli

# Autenticar (necessário uma vez)
apify login

# Publicar o actor (compila no Cloud, não localmente)
cd apify-actors/fotocasa
apify push
```

O build acontece no Cloud dentro do Dockerfile. Não é necessário compilar localmente.

## Variavel de Ambiente na App

Depois de fazer `apify push`, o nome do actor fica no formato `<username>/sparks-aloja-fotocasa`.

Adicionar ao `.env.local` da app Next.js:

```
APIFY_ACTOR_FOTOCASA=<username>/sparks-aloja-fotocasa
```

E ao Supabase Edge Function environment se o trigger vier do backend.

## Seletores - Estado Actual

Os seletores marcados com `// TODO` no `src/main.ts` foram escritos com base na estrutura observada do Fotocasa em meados de 2025, mas o Fotocasa usa React com classes CSS parcialmente hashed. Antes de colocar em producao:

1. Abrir `https://www.fotocasa.es/es/alquiler/viviendas/tarragona/todas-las-zonas/l` no browser
2. Inspecionar o DOM de um card de imóvel
3. Confirmar/actualizar os seletores em `src/main.ts`
4. Os seletores mais provaveis de quebrar: card container, preco, numero de quartos

## Riscos conhecidos

- Seletores CSS podem quebrar sem aviso (deploy de frontend do Fotocasa)
- Rate limiting pode activar-se com muitas paginas consecutivas — o crawler tem retries configurados
- Proxy RESIDENTIAL tem custo no Apify (ver pricing em console.apify.com)
- Imagens com lazy loading podem não ter src preenchido no momento do scrape — o ator tenta `data-src` como fallback
