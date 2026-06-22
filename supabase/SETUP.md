# Sparks Aloja — Setup Supabase

## 1. Criar tabelas

1. Abre o **SQL Editor** em https://supabase.com/dashboard
2. Cola e corre `supabase/schema.sql` completo

## 2. Correr o seed

Cola e corre `supabase/seed.sql` — insere os 60 alojamentos ativos do Allan
e os proprietários como contactos.

## 3. Criar utilizador admin

Na secção **Authentication → Users** do painel Supabase:
- Cria o utilizador `allansborges20@gmail.com` (ou convida via email)
- Depois, no SQL Editor, promove para admin:

```sql
update public.profiles
set role = 'admin'
where email = 'allansborges20@gmail.com';
```

## 4. Configurar autenticação

Em **Authentication → URL Configuration**:
- Site URL: `https://aloja.info-system.cloud`
- Redirect URLs: `https://aloja.info-system.cloud/**`

## 5. Verificar variáveis de ambiente

O `.env.local` já tem todas as chaves. Para produção (VPS / Vercel) copiar:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_API_KEY=
APIFY_API_TOKEN=
APIFY_ACTOR_MILANUNCIOS=leafed_photocopier/sparks-milanuncios
APIFY_ACTOR_HABITACLIA=leafed_photocopier/sparks-habitaclia
APIFY_ACTOR_HOMYSPACE=leafed_photocopier/sparks-homyspace
APIFY_ACTOR_SPOTAHOME=leafed_photocopier/sparks-spotahome
APIFY_ACTOR_UNIPLACES=leafed_photocopier/sparks-uniplaces
APIFY_ACTOR_FOTOCASA=leafed_photocopier/sparks-fotocasa
APIFY_ACTOR_AIRBNB=leafed_photocopier/sparks-airbnb
APIFY_ACTOR_IDEALISTA=leafed_photocopier/sparks-idealista
```
