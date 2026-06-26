-- ─── Onda 5: status da composição + conclusão (materialização) ────────────────
-- Adiciona ciclo de vida à composição (draft|saved|completed|archived) e a RPC
-- complete_combination, que "conclui" uma composição materializando os items
-- que ainda não existem como alojamentos ativos (active_accommodations).
--
-- Idempotente em dois níveis:
--   • DDL: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE
--   • RPC: guard de status (completed = no-op) + NOT EXISTS por (search_id,address)
--          para que reexecuções nunca dupliquem alojamentos.
--
-- Default 'saved': composições já existentes (todas salvas) herdam esse estado.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Colunas de ciclo de vida
-- ────────────────────────────────────────────────────────────────────────────
alter table public.combination_overrides
  add column if not exists status text not null default 'saved'
    check (status in ('draft', 'saved', 'completed', 'archived'));

alter table public.combination_overrides
  add column if not exists completed_at timestamptz;

create index if not exists idx_combination_overrides_status
  on public.combination_overrides(status);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) RPC complete_combination(p_combination_id)
--    Retorna o nº de alojamentos efetivamente criados (0 se idempotente/no-op).
--
--    Mapeamento combination_item → active_accommodation:
--      address      ← search_results.address → search_results.title → override_title
--      city         ← null (search_results não tem city estruturada)
--      lat/lng      ← search_results.{lat,lng} (null para 'manual')
--      total_beds   ← override_beds → search_results.num_beds → 0
--      monthly_rent ← override_final_price → override_monthly_rent → search_results.total_price
--      furnished    ← search_results.furnished → true (default p/ 'manual')
--      obra_name    ← searches.obra_name (da busca de origem da composição)
--      honorarium   ← override_honorarium
--      deposit      ← override_deposit
--      status       ← 'active'
--
--    Só materializa source_type in ('search','discarded','manual'); os 'active'
--    e 'external' já vivem em active_accommodations (seus source_id apontam lá).
--
--    Conclusão honesta: se algum item elegível não tiver NENHUM endereço
--    derivável, aborta (em vez de criar parcialmente e mentir na contagem).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.complete_combination(p_combination_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_search_id uuid;
  v_status    text;
  v_created   integer := 0;
  v_missing   integer := 0;
begin
  select search_id, status
    into v_search_id, v_status
    from public.combination_overrides
   where id = p_combination_id;

  if not found then
    raise exception 'Composição % não encontrada', p_combination_id
      using errcode = 'no_data_found';
  end if;

  -- Idempotência: concluir uma composição já concluída é no-op.
  if v_status = 'completed' then
    return 0;
  end if;

  -- Guard de conclusão honesta: nenhum item elegível pode ficar sem endereço.
  select count(*)
    into v_missing
    from public.combination_items ci
    left join public.search_results sr on sr.id = ci.source_id
   where ci.combination_id = p_combination_id
     and ci.source_type in ('search', 'discarded', 'manual')
     and coalesce(sr.address, sr.title, ci.override_title) is null;

  if v_missing > 0 then
    raise exception
      'Não dá para concluir: % item(ns) sem endereço para criar o alojamento', v_missing
      using errcode = 'check_violation';
  end if;

  with novos as (
    insert into public.active_accommodations (
      address, city, lat, lng,
      total_beds, monthly_rent, furnished,
      obra_name, search_id,
      honorarium, deposit, status
    )
    select
      coalesce(sr.address, sr.title, ci.override_title),
      null,
      sr.lat,
      sr.lng,
      coalesce(ci.override_beds, sr.num_beds, 0),
      round(coalesce(ci.override_final_price, ci.override_monthly_rent, sr.total_price))::integer,
      coalesce(sr.furnished, true),
      s.obra_name,
      v_search_id,
      coalesce(ci.override_honorarium, 0),
      coalesce(ci.override_deposit, 0),
      'active'
    from public.combination_items ci
    left join public.search_results sr on sr.id = ci.source_id
    left join public.searches       s  on s.id  = v_search_id
    where ci.combination_id = p_combination_id
      and ci.source_type in ('search', 'discarded', 'manual')
      and not exists (
        select 1
          from public.active_accommodations aa
         where aa.search_id = v_search_id
           and aa.address   = coalesce(sr.address, sr.title, ci.override_title)
      )
    returning 1
  )
  select count(*) into v_created from novos;

  update public.combination_overrides
     set status = 'completed',
         completed_at = now()
   where id = p_combination_id;

  return v_created;
end;
$$;
