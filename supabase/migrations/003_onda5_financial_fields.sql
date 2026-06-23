-- ─── Onda 5: campos financeiros (honorário + calção) ─────────────────────────
-- Adiciona honorarium e deposit em active_accommodations e search_results.
-- Idempotente: usa IF NOT EXISTS em todos os comandos.

-- active_accommodations
alter table public.active_accommodations
  add column if not exists honorarium numeric(10,2) not null default 0;

alter table public.active_accommodations
  add column if not exists deposit numeric(10,2) not null default 0;

-- search_results
alter table public.search_results
  add column if not exists honorarium numeric(10,2) not null default 0;

alter table public.search_results
  add column if not exists deposit numeric(10,2) not null default 0;
