-- Migration 005 — replace_combination: update transacional de composições
-- Substitui os 3 round-trips separados (update + delete + insert) por uma
-- função atómica. Se o insert falhar, o update e o delete são revertidos.

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
