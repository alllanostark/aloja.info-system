-- ─── Onda 5: status do alojamento ────────────────────────────────────────────
-- Adiciona coluna de estado ao alojamento ativo e índice correspondente.
-- Idempotente: usa IF NOT EXISTS em todos os comandos.

alter table public.active_accommodations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive', 'external'));

create index if not exists idx_accommodations_status
  on public.active_accommodations(status);
