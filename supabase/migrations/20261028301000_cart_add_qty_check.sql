-- LEARNING-98 · cart_add must reject a missing or out-of-range qty.
-- Before: least(null, 50) returned 50, so a line without qty became 50 portions.
create or replace function public.cart_add(p_table_code text, p_guest uuid, p_line jsonb)
returns int
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
  v_qty int := (p_line->>'qty')::int;
  v_addons uuid[] := private.sort_ids(coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(p_line->'addon_ids') x), '{}'));
begin
  if v_qty is null or v_qty not between 1 and 50 then
    raise exception 'INVALID_QTY';
  end if;
  v := private.guest_session(p_table_code, p_guest);
  perform private.price_line((p_line->>'menu_item_id')::uuid, (p_line->>'size_id')::uuid, v_addons);

  insert into public.cart_items (session_id, menu_item_id, size_id, addon_ids, note, qty, added_by)
  values (v.id, (p_line->>'menu_item_id')::uuid, (p_line->>'size_id')::uuid, v_addons,
          private.clean_note(p_line->>'note'), v_qty, p_guest)
  on conflict (session_id, menu_item_id, size_id, addon_ids, note, added_by)
  do update set qty = least(public.cart_items.qty + excluded.qty, 50), updated_at = now();

  update public.table_sessions set cart_version = cart_version + 1, last_activity_at = now()
  where id = v.id returning cart_version into v.cart_version;
  return v.cart_version;
end;
$$;
