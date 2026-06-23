-- ─── Onda 5: ligação alojamento → contacto ───────────────────────────────────
-- Adiciona FK opcional para contacts e índice correspondente.
-- Idempotente: usa IF NOT EXISTS em todos os comandos.

alter table public.active_accommodations
  add column if not exists contact_id uuid
    references public.contacts(id) on delete set null;

create index if not exists idx_accommodations_contact
  on public.active_accommodations(contact_id);
