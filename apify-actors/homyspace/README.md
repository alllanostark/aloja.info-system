# Sparks Aloja - Homyspace Scraper

Ator Apify que tenta recolher alojamentos do Homyspace.com para o projeto Sparks Aloja.

---

## AVISO — MODELO DE NEGOCIO INCOMPATIVEL COM SCRAPING PUBLICO

Homyspace e uma plataforma B2B de alojamento temporario para empresas. O seu modelo de negocio e **orcamento sob pedido**: o cliente submete datas, localizacao e numero de trabalhadores, e recebe propostas por email ou via painel interno.

**Nao existe grelha publica de imoveis com precos.** As listagens reais estao:
- Atras de autenticacao, ou
- Devolvidas via API privada apos submissao de formulario

Este ator tenta varios URLs candidatos e seletores genericos mas, enquanto o Homyspace mantiver este modelo, **devolvera 0 resultados**. Isso nao e um bug — e o comportamento esperado e correto. O ator termina limpo com codigo 0.

---

## O que o ator faz na pratica

1. Tenta aceder a URLs candidatas do tipo `/alojamiento/<slug>`, `/habitaciones/<slug>`, `/pisos/<slug>`
2. Procura cards de imoveis com seletores CSS genericos
3. Se encontrar algo (improvavel), extrai e filtra pelos criterios de negocio
4. Se nao encontrar nada (provavel), loga o aviso e termina

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

Quando existirem resultados (improvavel):

```json
{
  "title": "Alojamiento en Tarragona",
  "address": "Tarragona",
  "price_total": null,
  "num_beds": null,
  "furnished": true,
  "url": "https://www.homyspace.com/...",
  "platform": "homyspace",
  "images": [],
  "lat": null,
  "lng": null
}
```

---

## Deploy no Apify Cloud

```bash
npm i -g apify-cli
apify login
cd apify-actors/homyspace
apify push
```

---

## Variavel de ambiente na app

```
APIFY_ACTOR_HOMYSPACE=<username>/sparks-aloja-homyspace
```

Na app, trata o resultado deste ator como opcional — se devolver array vazio, continua normalmente com os dados de Habitaclia e Milanuncios.

---

## Alternativas recomendadas

Se dados do Homyspace forem essenciais para o negocio, ha tres caminhos:

**1. API parceiro (melhor opcao)**
Contactar Homyspace diretamente (`partnerships@homyspace.com` ou formulario em `/empresas`) e pedir acesso a API B2B. Plataformas deste tipo frequentemente dao acesso a parceiros com volume garantido.

**2. Substituir por plataforma com listagens publicas**
Sites com grelhas publicas e seletores estaveis:
- `spotahome.com` - media estancia, bons dados
- `uniplaces.com` - media estancia estudantil
- `badi.com` - quartos em pisos partilhados

**3. PlaywrightCrawler com conta registada**
Preencher o formulario de orcamento automaticamente e capturar a resposta. Implica:
- Criar conta registada
- Usar `PlaywrightCrawler` (browser headless) em vez de `CheerioCrawler`
- Custo muito mais alto em compute units Apify
- Risco de violacao dos ToS do Homyspace

---

## Riscos conhecidos

- **Devolvera 0 resultados**: comportamento esperado enquanto o site mantiver modelo B2B fechado.
- **Seletores totalmente especulativos**: todos marcados com `// TODO`. Nunca foram validados contra o DOM real porque nao ha paginas de listagem publicas.
- **URLs candidatas nao verificadas**: as rotas tentadas sao suposicoes baseadas em convencoes de URLs de sites de imoveis — podem todas retornar 404.
- **Lat/lng**: sempre `null`.
