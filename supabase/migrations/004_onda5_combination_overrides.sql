-- ─── Onda 5: composições editáveis ───────────────────────────────────────────
-- Cria combination_overrides e combination_items com RLS seguindo o padrão
-- do resto do schema (autenticados leem, admin gere).
-- A função set_updated_at() já existe no schema base.
-- Idempotente: usa IF NOT EXISTS em todos os comandos.

-- ────────────────────────────────────────────────────────────────────────────
-- combination_overrides
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.combination_overrides (
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

create index if not exists idx_combination_overrides_search
  on public.combination_overrides(search_id);

drop trigger if exists trg_combination_overrides_updated on public.combination_overrides;
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
-- combination_items
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.combination_items (
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

create index if not exists idx_combination_items_combo
  on public.combination_items(combination_id);

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
