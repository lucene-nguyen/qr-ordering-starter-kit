-- Phase 5 rollback – DB part (docs/runbooks/phase-5-release.md, section d). PROD, by hand, only
-- together with a Vercel rollback to the Phase 4 deployment. Keeps every row (payments, settings,
-- PINs); it only makes the schema work for the Phase 4 code again:
--   1. Phase 4 join_table closes idle sessions itself; the Phase 5 rule would refuse that ("UNPAID").
--   2. Phase 4 code calls join_table(p_table_code, p_name), which the Phase 5 migration dropped.
-- Tested on dev inside begin … rollback (2026-10-28). Re-releasing Phase 5 afterwards needs a new
-- migration that drops join_table(text, text) again and recreates both triggers.
begin;

drop trigger table_sessions_rules on public.table_sessions;
drop trigger payments_rules on public.payments;

-- Verbatim from supabase/migrations/20261028300000_phase4_shared_cart.sql (lines 158–192):

-- Join a table: reuse its open session or open one (closing a 4 h idle one), then add the guest.
create function public.join_table(p_table_code text, p_name text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_table_id uuid;
  v public.table_sessions;
  v_guest uuid;
  v_name text;
begin
  -- Locking the table row makes two first guests share one new session instead of racing.
  select t.id into v_table_id from public.tables t where t.code = p_table_code and t.is_active for update;
  if not found then
    raise exception 'TABLE_NOT_FOUND';
  end if;

  select * into v from public.table_sessions s where s.table_id = v_table_id and s.status = 'open';
  if found and v.last_activity_at < now() - interval '4 hours' then
    update public.table_sessions set status = 'closed', closed_at = now() where id = v.id;
    v := null;
  end if;
  if v.id is null then
    insert into public.table_sessions (table_id) values (v_table_id) returning * into v;
  end if;

  v_name := coalesce(
    left(nullif(btrim(p_name), ''), 20),
    'Guest ' || ((select count(*) from public.session_guests g where g.session_id = v.id) + 1));
  insert into public.session_guests (session_id, display_name) values (v.id, v_name) returning id into v_guest;
  update public.table_sessions set last_activity_at = now() where id = v.id;

  return jsonb_build_object('guest_id', v_guest, 'session_id', v.id, 'display_name', v_name);
end;
$$;

revoke execute on function public.join_table(text, text) from public, anon, authenticated;
grant execute on function public.join_table(text, text) to service_role;

commit;
