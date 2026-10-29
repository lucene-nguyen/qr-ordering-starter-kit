-- LEARNING-100 · Phase 6 – revenue reports (O2), owner only.
--
-- Rules (ADR 0004):
-- - Revenue = CONFIRMED payments of CLOSED sessions, counted on the day the session closed
--   (closed_at in Asia/Ho_Chi_Minh). A table that closes at 00:30 belongs to the new day.
-- - Money confirmed in a force-closed session is revenue; what it still owed is reported apart as
--   "Unpaid (closed by owner)".
-- - Dishes, categories and hours come from order_items / orders of every closed session (not
--   cancelled orders), so they also cover tables closed with money owed.
-- - Open sessions are not in any report yet ("Today so far" grows when a table closes).
--
-- The functions are SECURITY INVOKER: they read with the caller's RLS (owner reads everything they
-- need) and check the owner role first, because a cashier can read payments through RLS too.
-- The time zone is written here once: the database can't read the app's APP_TIMEZONE.

create index table_sessions_closed_at_idx on public.table_sessions(closed_at) where status = 'closed';

-- Revenue per day / week (Monday) / month between two local dates (both included). Empty buckets
-- come back as zeros, so the chart has no gaps.
create function public.report_revenue(p_from date, p_to date, p_grain text)
returns table (bucket date, revenue bigint, orders bigint, sessions bigint, unpaid bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if private.staff_role() is distinct from 'owner' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_grain not in ('day', 'week', 'month') then
    raise exception 'INVALID_GRAIN';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'INVALID_RANGE';
  end if;

  return query
  with s as (
    select date_trunc(p_grain, ts.closed_at at time zone 'Asia/Ho_Chi_Minh')::date as bucket,
           coalesce((select sum(p.amount) from public.payments p
                     where p.session_id = ts.id and p.status = 'confirmed'), 0) as paid,
           coalesce((select sum(o.total) from public.orders o
                     where o.session_id = ts.id and o.status <> 'cancelled'), 0) as bill,
           (select count(*) from public.orders o
            where o.session_id = ts.id and o.status <> 'cancelled') as n_orders
    from public.table_sessions ts
    where ts.status = 'closed'
      and ts.closed_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and ts.closed_at < ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  )
  select b.d::date,
         coalesce(sum(s.paid), 0)::bigint,
         coalesce(sum(s.n_orders), 0)::bigint,
         count(s.bucket),
         coalesce(sum(greatest(0, s.bill - s.paid)), 0)::bigint   -- only force-closed tables owe
  from generate_series(date_trunc(p_grain, p_from::timestamp), p_to::timestamp, ('1 ' || p_grain)::interval) b(d)
  left join s on s.bucket = b.d::date
  group by b.d
  order by b.d;
end;
$$;

-- Dishes sold in sessions closed between two local dates: quantity and revenue (unit price × qty
-- as charged). The page sums them per category.
create function public.report_items(p_from date, p_to date)
returns table (menu_item_id uuid, name text, category text, qty bigint, revenue bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if private.staff_role() is distinct from 'owner' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'INVALID_RANGE';
  end if;

  return query
  select m.id, m.name, c.name, sum(oi.qty)::bigint, sum(oi.unit_price * oi.qty)::bigint
  from public.table_sessions ts
  join public.orders o on o.session_id = ts.id and o.status <> 'cancelled'
  join public.order_items oi on oi.order_id = o.id
  join public.menu_items m on m.id = oi.menu_item_id
  join public.categories c on c.id = m.category_id
  where ts.status = 'closed'
    and ts.closed_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and ts.closed_at < ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  group by m.id, m.name, c.name
  order by 5 desc, 4 desc;
end;
$$;

-- Peak hours: orders and their value by the local hour they were placed (0–23), for sessions closed
-- between two local dates. Hours without orders are left out.
create function public.report_hours(p_from date, p_to date)
returns table (hour int, orders bigint, revenue bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if private.staff_role() is distinct from 'owner' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'INVALID_RANGE';
  end if;

  return query
  select extract(hour from o.created_at at time zone 'Asia/Ho_Chi_Minh')::int, count(*)::bigint, sum(o.total)::bigint
  from public.table_sessions ts
  join public.orders o on o.session_id = ts.id and o.status <> 'cancelled'
  where ts.status = 'closed'
    and ts.closed_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and ts.closed_at < ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  group by 1
  order by 1;
end;
$$;

revoke execute on function public.report_revenue(date, date, text), public.report_items(date, date),
  public.report_hours(date, date) from public, anon;
grant execute on function public.report_revenue(date, date, text), public.report_items(date, date),
  public.report_hours(date, date) to authenticated;
