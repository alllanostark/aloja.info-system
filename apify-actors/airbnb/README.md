# Sparks Aloja - Airbnb Scraper

Ator Apify que recolhe listagens de arrendamento mensal do Airbnb.es para o projeto Sparks Aloja (Grupo PF).

## AVISO: Fragilidade estrutural do Airbnb

O Airbnb tem duas caracteristicas que tornam o scraping particularmente frágil:

**1. Classes CSS hashed (CSS Modules)**
Todos os nomes de classe no DOM são gerados automaticamente (ex: `_1i0erp7e`, `dir dir-ltr`). Estes hashes mudam a cada deploy do Airbnb (várias vezes por semana). Qualquer seletor CSS que dependa destas classes quebra silenciosamente.

**2. Shadow blocking**
O sistema anti-bot do Airbnb frequentemente retorna páginas com aparência normal mas sem listings (resultados vazios), sem dar erro HTTP. É difícil distinguir "localização sem resultados" de "scraper bloqueado".

**Estratégia implementada: __NEXT_DATA__ first**

O ator tenta primeiro extrair os dados do JSON injectado pelo Next.js no elemento `<script id="__NEXT_DATA__">`. Este JSON contém todos os listings antes do React hydrate. É mais estável do que os seletores DOM mas o caminho dentro do JSON (`props.pageProps.staysSearch.results...`) também pode mudar com updates do Airbnb.

Se o `__NEXT_DATA__` não funcionar, o ator cai para scraping DOM como fallback (mais frágil).

**O Airbnb.es destina-se a estadias curtas.** Para arrendamentos mensais, o ator usa os filtros `flexible_trip_lengths[]=one_month` e `monthly_length=1`, que mostram preços mensais. Mas o inventário é diferente de plataformas como Fotocasa/Idealista — são maioritariamente apartamentos turísticos, não contratos de arrendamento tradicionais.

## O que faz

Pesquisa no Airbnb.es estadias mensais para a localização indicada. Usa paginação via cursor (sistema do Airbnb). O preço retornado é o preço total mensal (inclui taxas de limpeza amortizadas), não o preço por noite.

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
| `location` | string | sim | - | Cidade ou zona em texto livre. O Airbnb interpreta directamente. |
| `maxResults` | integer | não | 25 | Máximo de imóveis a recolher |
| `minBeds` | integer | não | 1 | Quartos mínimos (filtro aplicado no scraper, não na URL) |
| `maxPricePerPerson` | integer | não | 450 | Filtro: preço_total / num_beds <= este valor |

Nota: o filtro de preco na URL (`price_max`) usa `maxPricePerPerson * 4` como estimativa para 4 pessoas. Ajustar conforme o perfil de ocupação do Grupo PF.

## Contrato de Output (dataset)

```json
{
  "title": "Apartamento entero: 3 habitaciones, Tarragona",
  "address": "Tarragona",
  "price_total": 1200,
  "num_beds": 3,
  "furnished": true,
  "url": "https://www.airbnb.es/rooms/12345678",
  "platform": "airbnb",
  "images": ["https://a0.muscache.com/...", "..."],
  "lat": null,
  "lng": null
}
```

`furnished` é sempre `true` para o Airbnb — todos os alojamentos são mobilados por definição.

`lat` e `lng` são `null` nesta versão. O Airbnb expõe coordenadas aproximadas no `__NEXT_DATA__` mas com ofuscação intencional (arredondamento para ~150m) — não foi implementado por ser pouco útil para o caso de uso.

## Deploy no Apify Cloud

```bash
cd apify-actors/airbnb
apify push
```

Variavel de ambiente na app:

```
APIFY_ACTOR_AIRBNB=<username>/sparks-aloja-airbnb
```

## Manutenção esperada

Este ator vai precisar de actualizações mais frequentes do que os outros:

- Verificar caminho do `__NEXT_DATA__` após cada update major do Airbnb
- Verificar `data-testid` no fallback DOM (mudam com menos frequência que as classes CSS mas mudam)
- Verificar parâmetros de URL de busca (o Airbnb adiciona/remove query params regularmente)

Recomendado: testar manualmente a cada 2-4 semanas, ou monitorizar o dataset no Apify por taxa de 0 resultados.

## Alternativa recomendada

O Airbnb não tem API pública para scraping. Para uma solução mais robusta considerar:
- Apify Store: existe um actor público `dtrungtin/airbnb-scraper` mantido pela comunidade — pode ser mais actualizado
- Integração directa via API de parceiros Airbnb (requer certificação como property manager)

## Riscos conhecidos

- Shadow blocking sem aviso (resultados vazios = bloqueado ou sem stock)
- Caminho do `__NEXT_DATA__` muda com updates do Airbnb (vários por semana)
- Classes CSS hashed no fallback DOM quebram silenciosamente
- Preços mensais incluem taxa de limpeza amortizada — pode ser significativamente superior ao "aluguer real"
- Airbnb limita resultados de busca a ~300 listings por query mesmo sem paginação completa
- Proxy RESIDENTIAL obrigatório — datacenter é bloqueado imediatamente
