-- DEV ONLY · removes exactly what seed-reports.sql created: table R1 and its sessions, orders,
-- order items and payments. Nothing on any other table is touched. Safe to run twice.
-- The last statement shows how many rows were deleted per table.

create temp table if not exists cleanup_reports_result (what text, deleted int);
truncate cleanup_reports_result;

do $$
declare
  v_table uuid;
  n int;
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000000')
     or not exists (select 1 from auth.users where email like '%@phomay.example') then
    raise exception 'NOT_DEV: this cleanup only runs on tabletap-dev';
  end if;
  -- Only the inactive seed table: a real table that someone named R1 would be active.
  select id into v_table from public.tables where code = 'R1' and not is_active;
  if not found then
    insert into cleanup_reports_result values ('nothing to clean (no inactive table R1)', 0);
    return;
  end if;

  with d as (delete from public.payments p using public.table_sessions s
             where p.session_id = s.id and s.table_id = v_table returning 1)
  select count(*) into n from d;
  insert into cleanup_reports_result values ('payments', n);

  with d as (delete from public.order_items i using public.orders o
             where i.order_id = o.id and o.table_id = v_table returning 1)
  select count(*) into n from d;
  insert into cleanup_reports_result values ('order_items', n);

  with d as (delete from public.orders o where o.table_id = v_table returning 1)
  select count(*) into n from d;
  insert into cleanup_reports_result values ('orders', n);

  with d as (delete from public.table_sessions s where s.table_id = v_table returning 1)
  select count(*) into n from d;
  insert into cleanup_reports_result values ('table_sessions', n);

  with d as (delete from public.tables t where t.id = v_table returning 1)
  select count(*) into n from d;
  insert into cleanup_reports_result values ('tables (R1)', n);
end;
$$;

select * from cleanup_reports_result;
