-- ═══════════════════════════════════════════════════════════════════════
-- Sparks Aloja — Schema Supabase
-- Executar no SQL Editor do painel Supabase (em ordem, uma vez)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Extensões ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tipos ENUM ─────────────────────────────────────────────────────────
create type user_role        as enum ('admin', 'viewer');
create type search_status    as enum ('active', 'completed', 'abandoned');
create type result_status    as enum ('new', 'saved', 'discarded');
create type property_platform as enum (
  'idealista', 'fotocasa', 'habitaclia', 'homyspace',
  'milanuncios', 'airbnb', 'vivara', 'spotahome', 'uniplaces'
);
create type discard_reason   as enum ('price', 'distance', 'owner', 'condition', 'other');
create type contact_rating   as enum ('good', 'neutral', 'bad');

-- ─── Trigger para updated_at ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. PROFILES
-- ════════════════════════════════════════════════════════════════════════
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        user_role   not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

-- Criação automática de perfil ao registar utilizador
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'viewer'
  );
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Utilizadores veem o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admin vê todos os perfis"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Utilizadores atualizam o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ════════════════════════════════════════════════════════════════════════
-- 2. SEARCHES
-- ════════════════════════════════════════════════════════════════════════
create table public.searches (
  id                uuid          primary key default uuid_generate_v4(),
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  created_by        uuid          references public.profiles(id) on delete set null,
  obra_name         text,
  obra_address      text          not null,
  obra_lat          double precision,
  obra_lng          double precision,
  num_workers       integer       not null check (num_workers > 0),
  duration_weeks    integer       check (duration_weeks > 0),
  budget_per_person numeric(10,2) not null check (budget_per_person > 0),
  max_drive_minutes integer       not null default 45 check (max_drive_minutes > 0),
  status            search_status not null default 'active'
);

create index idx_searches_created_by  on public.searches(created_by);
create index idx_searches_status      on public.searches(status);
create index idx_searches_created_at  on public.searches(created_at desc);

create trigger trg_searches_updated_at
  before update on public.searches
  for each row execute function set_updated_at();

alter table public.searches enable row level security;

create policy "Autenticados leem buscas"
  on public.searches for select
  using (auth.uid() is not null);

create policy "Admin cria buscas"
  on public.searches for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin atualiza buscas"
  on public.searches for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 3. SEARCH_RESULTS
-- ════════════════════════════════════════════════════════════════════════
create table public.search_results (
  id               uuid              primary key default uuid_generate_v4(),
  created_at       timestamptz       not null default now(),
  search_id        uuid              not null references public.searches(id) on delete cascade,
  platform         property_platform not null,
  external_url     text,
  title            text,
  address          text,
  lat              double precision,
  lng              double precision,
  total_price      integer,
  num_beds         integer           check (num_beds > 0),
  -- Custo por pessoa calculado (coluna gerada — nunca escrever diretamente)
  cost_per_person  numeric(10,2)     generated always as (
    case when total_price is not null and num_beds is not null and num_beds > 0
      then round((total_price::numeric / num_beds), 2)
      else null
    end
  ) stored,
  drive_minutes    integer,
  furnished        boolean           not null default true,
  images           jsonb             not null default '[]',
  raw_data         jsonb,
  status           result_status     not null default 'new',
  honorarium       numeric(10,2)     not null default 0,  -- onda 5
  deposit          numeric(10,2)     not null default 0   -- onda 5
);

create index idx_results_search_id       on public.search_results(search_id);
create index idx_results_status          on public.search_results(status);
create index idx_results_cost_per_person on public.search_results(cost_per_person asc nulls last);
create index idx_results_platform        on public.search_results(platform);

alter table public.search_results enable row level security;

create policy "Autenticados leem resultados"
  on public.search_results for select
  using (auth.uid() is not null);

create policy "Admin insere resultados"
  on public.search_results for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin atualiza resultados"
  on public.search_results for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 4. DISCARDED_RESULTS
-- ════════════════════════════════════════════════════════════════════════
create table public.discarded_results (
  id         uuid           primary key default uuid_generate_v4(),
  created_at timestamptz    not null default now(),
  result_id  uuid           not null references public.search_results(id) on delete cascade,
  reason     discard_reason not null default 'other',
  notes      text
);

create index idx_discarded_result_id on public.discarded_results(result_id);

alter table public.discarded_results enable row level security;

create policy "Autenticados leem descartes"
  on public.discarded_results for select
  using (auth.uid() is not null);

create policy "Admin gere descartes"
  on public.discarded_results for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 5. ACTIVE_ACCOMMODATIONS
-- ════════════════════════════════════════════════════════════════════════
create table public.active_accommodations (
  id              uuid          primary key default uuid_generate_v4(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  address         text          not null,
  city            text,
  lat             double precision,
  lng             double precision,
  total_beds      integer       not null default 1 check (total_beds > 0),
  monthly_rent    numeric(10,2),
  furnished       boolean       not null default true,
  obra_name       text,
  search_id       uuid          references public.searches(id) on delete set null,
  contact_id      uuid          references public.contacts(id) on delete set null,  -- onda 5
  contract_start  date,
  contract_end    date,
  owner_name      text,
  owner_phone     text,
  notes           text,
  status          text          not null default 'active'                            -- onda 5
                                  check (status in ('active', 'inactive', 'external')),
  honorarium      numeric(10,2) not null default 0,                                  -- onda 5
  deposit         numeric(10,2) not null default 0                                   -- onda 5
);

create index idx_accommodations_search_id on public.active_accommodations(search_id);
create index idx_accommodations_city      on public.active_accommodations(city);
create index idx_accommodations_status    on public.active_accommodations(status);   -- onda 5
create index idx_accommodations_contact   on public.active_accommodations(contact_id); -- onda 5

create trigger trg_accommodations_updated_at
  before update on public.active_accommodations
  for each row execute function set_updated_at();

alter table public.active_accommodations enable row level security;

create policy "Autenticados leem alojamentos"
  on public.active_accommodations for select
  using (auth.uid() is not null);

create policy "Admin gere alojamentos"
  on public.active_accommodations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 6. BED_OCCUPANTS
-- ════════════════════════════════════════════════════════════════════════
create table public.bed_occupants (
  id                 uuid        primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  accommodation_id   uuid        not null references public.active_accommodations(id) on delete cascade,
  bed_number         integer     not null check (bed_number > 0),
  worker_name        text,
  entry_date         date,
  exit_date          date,
  constraint chk_exit_after_entry check (
    exit_date is null or entry_date is null or exit_date >= entry_date
  )
);

create index idx_bed_occupants_accommodation on public.bed_occupants(accommodation_id);
create index idx_bed_occupants_active        on public.bed_occupants(accommodation_id) where exit_date is null;

alter table public.bed_occupants enable row level security;

create policy "Autenticados leem ocupantes"
  on public.bed_occupants for select
  using (auth.uid() is not null);

create policy "Admin gere ocupantes"
  on public.bed_occupants for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 7. CONTACTS
-- ════════════════════════════════════════════════════════════════════════
create table public.contacts (
  id         uuid           primary key default uuid_generate_v4(),
  created_at timestamptz    not null default now(),
  updated_at timestamptz    not null default now(),
  name       text           not null,
  company    text,
  phone      text,
  email      text,
  city       text,
  rating     contact_rating not null default 'neutral',
  notes      text,
  last_used  timestamptz
);

create index idx_contacts_rating   on public.contacts(rating);
create index idx_contacts_city     on public.contacts(city);
create index idx_contacts_last_used on public.contacts(last_used desc nulls last);

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function set_updated_at();

alter table public.contacts enable row level security;

create policy "Autenticados leem contactos"
  on public.contacts for select
  using (auth.uid() is not null);

create policy "Admin gere contactos"
  on public.contacts for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 8. SEARCH_COMBINATIONS (combinações guardadas — computadas em memória,
--    persistidas para histórico)
-- ════════════════════════════════════════════════════════════════════════
create table public.search_combinations (
  id              uuid          primary key default uuid_generate_v4(),
  created_at      timestamptz   not null default now(),
  search_id       uuid          not null references public.searches(id) on delete cascade,
  result_ids      uuid[]        not null,
  total_price     integer       not null,
  total_beds      integer       not null,
  cost_per_person numeric(10,2) generated always as (
    case when total_beds > 0
      then round((total_price::numeric / total_beds), 2)
      else null
    end
  ) stored,
  label           text
);

create index idx_combinations_search_id on public.search_combinations(search_id);

alter table public.search_combinations enable row level security;

create policy "Autenticados leem combinações"
  on public.search_combinations for select
  using (auth.uid() is not null);

create policy "Admin gere combinações"
  on public.search_combinations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 9. COMBINATION_OVERRIDES + COMBINATION_ITEMS  (Onda 5: composições editáveis)
-- ════════════════════════════════════════════════════════════════════════
create table public.combination_overrides (
  id             uuid        primary key default uuid_generate_v4(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search_id      uuid        not null references public.searches(id) on delete cascade,
  label          text        not null,
  duration_value int         not null default 1 check (duration_value > 0),
  duration_unit  text        not null default 'months'
                               check (duration_unit in ('months', 'weeks', 'days')),
  notes          text
);

create index idx_combination_overrides_search on public.combination_overrides(search_id);

create trigger trg_combination_overrides_updated
  before update on public.combination_overrides
  for each row execute function public.set_updated_at();

alter table public.combination_overrides enable row level security;

create policy "Autenticados leem composições"
  on public.combination_overrides for select
  using (auth.uid() is not null);

create policy "Admin gere composições"
  on public.combination_overrides for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────

create table public.combination_items (
  id                     uuid          primary key default uuid_generate_v4(),
  created_at             timestamptz   not null default now(),
  combination_id         uuid          not null
                           references public.combination_overrides(id) on delete cascade,
  source_type            text          not null
                           check (source_type in ('search', 'active', 'external', 'discarded', 'manual')),
  source_id              uuid,
  override_title         text,
  override_beds          int,
  override_drive_minutes int,
  override_monthly_rent  numeric(10,2),
  override_deposit       numeric(10,2) not null default 0,
  override_honorarium    numeric(10,2) not null default 0,
  override_final_price   numeric(10,2),
  position               int           not null default 0
);

create index idx_combination_items_combo on public.combination_items(combination_id);

alter table public.combination_items enable row level security;

create policy "Autenticados leem itens de composição"
  on public.combination_items for select
  using (auth.uid() is not null);

create policy "Admin gere itens de composição"
  on public.combination_items for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─── Função transacional: substitui itens de uma composição existente ─────────
-- Garante atomicidade: se o insert falhar, o update e o delete são revertidos.

create or replace function public.replace_combination(
  p_combination_id uuid,
  p_label          text,
  p_duration_value int,
  p_duration_unit  text,
  p_notes          text,
  p_items          jsonb
) returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.combination_overrides
     set label          = p_label,
         duration_value = p_duration_value,
         duration_unit  = p_duration_unit,
         notes          = p_notes
   where id = p_combination_id;

  delete from public.combination_items
   where combination_id = p_combination_id;

  insert into public.combination_items (
    combination_id,
    source_type,
    source_id,
    override_title,
    override_beds,
    override_drive_minutes,
    override_monthly_rent,
    override_deposit,
    override_honorarium,
    override_final_price,
    position
  )
  select
    p_combination_id,
    (it->>'source_type')::text,
    nullif(it->>'source_id', '')::uuid,
    it->>'override_title',
    nullif(it->>'override_beds', '')::int,
    nullif(it->>'override_drive_minutes', '')::int,
    nullif(it->>'override_monthly_rent', '')::numeric,
    coalesce((it->>'override_deposit')::numeric, 0),
    coalesce((it->>'override_honorarium')::numeric, 0),
    nullif(it->>'override_final_price', '')::numeric,
    coalesce((it->>'position')::int, 0)
  from jsonb_array_elements(p_items) as it;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════════════

-- Ocupação por alojamento (usada no dashboard)
create or replace view public.accommodation_occupancy
with (security_invoker = true) as
select
  a.id,
  a.address,
  a.city,
  a.obra_name,
  a.total_beds,
  count(o.id) filter (where o.exit_date is null)::integer as occupied,
  (a.total_beds - count(o.id) filter (where o.exit_date is null))::integer as vacant
from public.active_accommodations a
left join public.bed_occupants o on o.accommodation_id = a.id
group by a.id, a.address, a.city, a.obra_name, a.total_beds;

-- ════════════════════════════════════════════════════════════════════════
-- ADMIN INICIAL
-- Depois de criar o utilizador Ingrid no Supabase Auth,
-- atualizar o role para 'admin' com este comando:
--
--   update public.profiles
--   set role = 'admin'
--   where email = 'allansborges20@gmail.com';
--
-- ════════════════════════════════════════════════════════════════════════
