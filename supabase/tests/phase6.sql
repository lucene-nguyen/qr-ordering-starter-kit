-- Phase 6 (LEARNING-100) database tests – run on DEV only (SQL Editor of tabletap-dev).
-- Same as phase5.sql: one DO block that ends with `raise exception 'ALL_OK'`, which rolls the whole
-- block back. Seeing "ERROR: ALL_OK" means every assert passed; any other error names the failing
-- check (R1…R8, AC1, I1…I2, P1, N1…N2).
-- The test data lives in March 2020, so dev's own (E2E) sessions never fall in the tested ranges.
-- Needs: seed.sql (menu, tables) and the staff accounts hoa@ (owner), an@ (cashier), bep@ (kitchen).

-- Helpers for this connection only (pg_temp): a session with its own open/close times, and an
-- order with one line. Inserting a closed session directly skips the close trigger, which would
-- stamp closed_at = now().
create or replace function pg_temp.add_session(p_table uuid, p_opened timestamptz, p_closed timestamptz,
                                               p_reason text default null)
returns uuid language sql as $$
  insert into public.table_sessions (table_id, status, opened_at, closed_at, closed_reason)
  values (p_table, case when p_closed is null then 'open' else 'closed' end, p_opened, p_closed, p_reason)
  returning id;
$$;

create or replace function pg_temp.add_order(p_session uuid, p_at timestamptz, p_item uuid, p_price int,
                                             p_qty int, p_status public.order_status default 'served')
returns void language sql as $$
  with o as (
    insert into public.orders (table_id, session_id, status, total, idempotency_key, created_at)
    select s.table_id, s.id, p_status, p_price * p_qty, gen_random_uuid(), p_at
    from public.table_sessions s where s.id = p_session
    returning id
  )
  insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price, qty)
  select o.id, p_item, (select m.name from public.menu_items m where m.id = p_item), p_price, p_qty from o;
$$;

do $$
declare
  own uuid := (select id from auth.users where email = 'hoa@phomay.example');
  cas uuid := (select id from auth.users where email = 'an@phomay.example');
  kit uuid := (select id from auth.users where email = 'bep@phomay.example');
  pho uuid := (select id from menu_items where name = 'Phở bò tái');
  bun uuid := (select id from menu_items where name = 'Bún chả Hà Nội');
  t04 uuid := (select id from tables where code = '04');
  free_table uuid := (select t.id from tables t where t.is_active and not exists
                       (select 1 from table_sessions s where s.table_id = t.id and s.status = 'open') limit 1);
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
  ok boolean; who uuid;
begin
  assert free_table is not null, 'setup: needs one active table without an open session';

  -- S1 · lunch on 10 Mar: 100.000 served + a cancelled 50.000 order; paid 40.000 VietQR + 60.000 cash,
  -- plus a withdrawn 30.000 request
  s1 := pg_temp.add_session(t04, '2020-03-10 11:00+07', '2020-03-10 12:30+07');
  perform pg_temp.add_order(s1, '2020-03-10 11:15+07', pho, 50000, 2);
  perform pg_temp.add_order(s1, '2020-03-10 11:20+07', bun, 50000, 1, 'cancelled');
  insert into payments (session_id, amount, method, status) values
    (s1, 40000, 'vietqr', 'confirmed'), (s1, 60000, 'cash', 'confirmed'), (s1, 30000, 'vietqr', 'cancelled');

  -- S2 · closes at 23:30 on 10 Mar (16:30 UTC)
  s2 := pg_temp.add_session(t04, '2020-03-10 22:30+07', '2020-03-10 23:30+07');
  perform pg_temp.add_order(s2, '2020-03-10 22:40+07', pho, 65000, 1);
  insert into payments (session_id, amount, method, status) values (s2, 65000, 'cash', 'confirmed');

  -- S3 · ordered at 23:50 on 10 Mar, closes at 00:30 on 11 Mar (still 10 Mar in UTC): 11 Mar revenue
  s3 := pg_temp.add_session(t04, '2020-03-10 23:40+07', '2020-03-11 00:30+07');
  perform pg_temp.add_order(s3, '2020-03-10 23:50+07', bun, 60000, 1);
  insert into payments (session_id, amount, method, status) values (s3, 60000, 'vietqr', 'confirmed');

  -- S4 · force-closed on 11 Mar: bill 200.000, only 83.000 confirmed
  s4 := pg_temp.add_session(t04, '2020-03-11 12:00+07', '2020-03-11 13:00+07', 'Guests left without paying');
  perform pg_temp.add_order(s4, '2020-03-11 12:05+07', pho, 50000, 2);
  perform pg_temp.add_order(s4, '2020-03-11 12:10+07', bun, 100000, 1);
  insert into payments (session_id, amount, method, status) values (s4, 83000, 'vietqr', 'confirmed');

  -- S5 · still open, with a confirmed payment and an order at 18:10: in no report yet
  s5 := pg_temp.add_session(free_table, '2020-03-11 18:00+07', null);
  perform pg_temp.add_order(s5, '2020-03-11 18:10+07', pho, 999000, 1);
  insert into payments (session_id, amount, method, status) values (s5, 999000, 'cash', 'confirmed');

  ------------------------------------------------------------ R. revenue, as the owner
  perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  assert (select r.revenue = 165000 and r.orders = 2 and r.sessions = 2 and r.unpaid = 0
          from public.report_revenue('2020-03-10', '2020-03-11', 'day') r where r.bucket = '2020-03-10'),
    'R1 10 Mar = S1 100.000 + S2 65.000 (cancelled order and withdrawn request left out)';
  assert (select r.revenue = 143000 and r.orders = 3 and r.sessions = 2 and r.unpaid = 117000
          from public.report_revenue('2020-03-10', '2020-03-11', 'day') r where r.bucket = '2020-03-11'),
    'R2 11 Mar = S3 60.000 + force-closed S4 83.000; S4 still owed 117.000';
  assert (select r.revenue = 165000 from public.report_revenue('2020-03-10', '2020-03-10', 'day') r),
    'R3 Asia/Ho_Chi_Minh days: 23:30 stays on 10 Mar, 00:30 moves to 11 Mar';
  assert (select count(*) = 3 and bool_and(r.revenue = 0 and r.sessions = 0) filter (where r.bucket = '2020-03-09')
          from public.report_revenue('2020-03-09', '2020-03-11', 'day') r),
    'R4 a day without sessions comes back as 0 (no gaps)';
  assert (select count(*) = 1 and min(r.bucket) = '2020-03-09' and sum(r.revenue) = 308000 and sum(r.unpaid) = 117000
          from public.report_revenue('2020-03-10', '2020-03-11', 'week') r),
    'R5 week starts on Monday 9 Mar: 308.000, 117.000 unpaid';
  assert (select count(*) = 1 and min(r.bucket) = '2020-03-01' and sum(r.revenue) = 308000
          from public.report_revenue('2020-03-01', '2020-03-31', 'month') r),
    'R6 month: one bucket, 308.000';
  begin perform public.report_revenue('2020-03-10', '2020-03-11', 'year'); ok := false;
  exception when others then ok := sqlerrm = 'INVALID_GRAIN'; end;
  assert ok, 'R7 grain must be day, week or month';
  begin perform public.report_revenue('2020-03-11', '2020-03-10', 'day'); ok := false;
  exception when others then ok := sqlerrm = 'INVALID_RANGE'; end;
  assert ok, 'R8 from must not be after to';

  -- AC1: on a day of fully paid tables, revenue = the sum of their (not cancelled) orders
  assert (select r.revenue from public.report_revenue('2020-03-10', '2020-03-10', 'day') r)
       = (select sum(o.total) from orders o join table_sessions s on s.id = o.session_id
          where o.status <> 'cancelled' and s.status = 'closed' and s.closed_reason is null
            and (s.closed_at at time zone 'Asia/Ho_Chi_Minh')::date = '2020-03-10'),
    'AC1 daily revenue matches the sum of paid orders for that day';

  ------------------------------------------------------------ I. dishes, P. peak hours (every closed session)
  assert (select array_agg(i.name || ':' || i.qty || ':' || i.revenue order by i.revenue desc)
          from public.report_items('2020-03-10', '2020-03-11') i)
       = array['Phở bò tái:5:265000', 'Bún chả Hà Nội:2:160000'],
    'I1 Phở 2+1+2 = 5 (265.000), Bún chả 1+1 = 2 (160.000): force-closed S4 in, cancelled order and open S5 out';
  assert (select bool_and(i.category is not null) from public.report_items('2020-03-10', '2020-03-11') i),
    'I2 every dish has its category';
  assert (select array_agg(h.hour || ':' || h.orders || ':' || h.revenue order by h.hour)
          from public.report_hours('2020-03-10', '2020-03-11') h)
       = array['11:1:100000', '12:2:200000', '22:1:65000', '23:1:60000'],
    'P1 orders by local hour placed (S3''s 23:50 order counts at 23; open S5''s 18:10 is not there)';
  execute 'reset role';

  ------------------------------------------------------------ N. only the owner
  foreach who in array array[cas, kit] loop
    perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin perform public.report_revenue('2020-03-10', '2020-03-11', 'day'); ok := false;
    exception when others then ok := sqlerrm = 'NOT_ALLOWED'; end;
    assert ok, 'N1 cashier/kitchen: report_revenue is NOT_ALLOWED';
    begin perform public.report_items('2020-03-10', '2020-03-11'); ok := false;
    exception when others then ok := sqlerrm = 'NOT_ALLOWED'; end;
    assert ok, 'N1 cashier/kitchen: report_items is NOT_ALLOWED';
    begin perform public.report_hours('2020-03-10', '2020-03-11'); ok := false;
    exception when others then ok := sqlerrm = 'NOT_ALLOWED'; end;
    assert ok, 'N1 cashier/kitchen: report_hours is NOT_ALLOWED';
    execute 'reset role';
  end loop;

  execute 'set local role anon';
  begin perform public.report_revenue('2020-03-10', '2020-03-11', 'day'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  execute 'reset role';
  assert ok, 'N2 anon may not even call the report functions';

  raise exception 'ALL_OK';
end;
$$;
