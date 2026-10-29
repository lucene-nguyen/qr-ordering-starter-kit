-- DEV ONLY · LEARNING-100 · history for O2 Reports: ~3.000 orders over the 90 days BEFORE today.
--
-- Everything lives on table R1 (is_active = false: not on S1, the QR page or the guest app), so
-- cleanup-reports.sql can remove exactly this data. Today is left alone, so "Today so far" and
-- E2E table-flow (f) see only real activity.
-- Mix: ~4% of tables force-closed with part of the bill paid, ~3% cancelled orders, cash / full VietQR /
-- split shares. Random but repeatable (setseed). order_no is 'R-00001'…, so the real A-#### sequence is untouched.
--
-- Run in one go (SQL Editor or MCP execute_sql). It refuses to run twice; run cleanup first.

do $$
declare
  v_table uuid;
  v_day date;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_session uuid;
  v_order uuid;
  v_opened timestamptz;
  v_closed timestamptz;
  v_bill int;
  v_paid int;
  v_total int;
  v_n int := 0;
  v_line record;
  i int; j int; k int;
begin
  -- Dev only: dev's migration history uses the file versions (supabase migration repair, see
  -- supabase/README.md); prod's uses the times the MCP applied them. Dev also has the example staff.
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000000')
     or not exists (select 1 from auth.users where email like '%@phomay.example') then
    raise exception 'NOT_DEV: this seed only runs on tabletap-dev';
  end if;
  if exists (select 1 from public.tables where code = 'R1') then
    raise exception 'ALREADY_SEEDED: run supabase/dev/cleanup-reports.sql first';
  end if;

  perform setseed(0.42);
  insert into public.tables (code, label, is_active) values ('R1', 'Table R1 (report seed)', false)
  returning id into v_table;

  for d in 1..90 loop
    v_day := v_today - d;
    -- busier at weekends: 10–15 tables on weekdays, 14–19 on Saturday/Sunday
    for i in 1..(10 + floor(random() * 6)::int + case when extract(isodow from v_day) >= 6 then 4 else 0 end) loop
      -- opened between 10:00 and 21:59 local, closed 30–110 minutes later: always the same day
      v_opened := (v_day + make_time(10 + floor(random() * 12)::int, floor(random() * 60)::int, 0))
                  at time zone 'Asia/Ho_Chi_Minh';
      v_closed := v_opened + make_interval(mins => 30 + floor(random() * 80)::int);
      if (v_closed at time zone 'Asia/Ho_Chi_Minh')::date <> v_day then
        v_closed := (v_day + time '23:59') at time zone 'Asia/Ho_Chi_Minh';
      end if;

      insert into public.table_sessions (table_id, status, opened_at, closed_at, closed_reason)
      values (v_table, 'closed', v_opened, v_closed, null)
      returning id into v_session;

      v_bill := 0;
      for j in 1..(1 + floor(random() * 4)::int) loop          -- 1–4 rounds per table
        v_n := v_n + 1;
        insert into public.orders (order_no, table_id, session_id, status, total, idempotency_key, created_at)
        values ('R-' || lpad(v_n::text, 5, '0'), v_table, v_session,
                case when random() < 0.03 then 'cancelled' else 'served' end::public.order_status,
                0, gen_random_uuid(), v_opened + make_interval(mins => 5 + (j - 1) * 12))
        returning id into v_order;

        v_total := 0;
        for k in 1..(1 + floor(random() * 3)::int) loop        -- 1–3 dishes per round
          select m.id, m.name, m.price into v_line from public.menu_items m order by random() limit 1;
          insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price, qty)
          values (v_order, v_line.id, v_line.name, v_line.price, 1 + floor(random() * 3)::int)
          returning v_total + unit_price * qty into v_total;
        end loop;
        update public.orders set total = v_total where id = v_order;
        if (select status from public.orders where id = v_order) <> 'cancelled' then
          v_bill := v_bill + v_total;
        end if;
      end loop;

      if v_bill = 0 then
        continue;                                              -- every round cancelled: nothing to pay
      elsif random() < 0.04 then
        -- force-closed: guests paid part (or nothing) and left
        update public.table_sessions set closed_reason = 'Seed: guests left without paying' where id = v_session;
        v_paid := floor(v_bill * random() * 0.6 / 1000)::int * 1000;
        if v_paid > 0 then
          insert into public.payments (session_id, payer_name, amount, method, status)
          values (v_session, 'Seed guest', v_paid, 'vietqr', 'confirmed');
        end if;
      elsif random() < 0.55 then
        insert into public.payments (session_id, payer_name, amount, method, status)
        values (v_session, 'Cash at the counter', v_bill, 'cash', 'confirmed');
      elsif random() < 0.7 then
        insert into public.payments (session_id, payer_name, amount, method, status, reference)
        values (v_session, 'Seed guest', v_bill, 'vietqr', 'confirmed', 'TBLR1 SEED');
      else
        -- split in two: first share rounded down to 1.000đ, the second takes the rest
        v_paid := (v_bill / 2 / 1000) * 1000;
        insert into public.payments (session_id, payer_name, kind, amount, method, status, reference) values
          (v_session, 'Seed guest 1', 'share', v_paid, 'vietqr', 'confirmed', 'TBLR1 SEED'),
          (v_session, 'Seed guest 2', 'share', v_bill - v_paid, 'vietqr', 'confirmed', 'TBLR1 SEED');
      end if;
    end loop;
  end loop;
end;
$$;

-- What was created (the update on closed_reason above does not fire the close trigger: status stays 'closed')
select count(distinct s.id) as sessions,
       count(distinct s.id) filter (where s.closed_reason is not null) as force_closed,
       count(o.id) as orders,
       count(o.id) filter (where o.status = 'cancelled') as cancelled_orders,
       min((s.closed_at at time zone 'Asia/Ho_Chi_Minh')::date) as first_day,
       max((s.closed_at at time zone 'Asia/Ho_Chi_Minh')::date) as last_day
from public.table_sessions s
join public.tables t on t.id = s.table_id and t.code = 'R1'
left join public.orders o on o.session_id = s.id;
