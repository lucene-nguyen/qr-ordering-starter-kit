-- LEARNING-99 · Phase 5 – staff-opened sessions with a PIN, rate limits, payments (ADR 0003)
--
-- Trust model:
--   guests  → only through service_role functions (Server Actions, after the tt_guest cookie check)
--   staff   → plain inserts/updates with their own session; RLS picks the rows, column grants pick
--             the columns, and BEFORE triggers enforce the business rules on the row itself, so the
--             rules hold even if someone calls the REST API directly.

-- Sessions: opened and closed by staff ------------------------------------
alter table public.table_sessions
  -- random() is not cryptographic, but the PIN is never shown to guests' devices and wrong
  -- guesses are rate-limited (join_table), so it only has to be unpredictable from outside.
  add column pin text not null default lpad(floor(random() * 10000)::int::text, 4, '0')
    check (pin ~ '^[0-9]{4}$'),
  add column opened_by uuid default auth.uid() references auth.users(id),
  add column closed_by uuid references auth.users(id),
  add column closed_reason text check (closed_reason is null or char_length(closed_reason) <= 200),
  add column split_people int check (split_people between 2 and 8);
create index table_sessions_opened_by_idx on public.table_sessions(opened_by);
create index table_sessions_closed_by_idx on public.table_sessions(closed_by);

-- Staff (owner, cashier) may open and close; kitchen may only read.
create policy "Owner and cashier open sessions" on public.table_sessions for insert to authenticated
  with check ((select private.staff_role()) in ('owner', 'cashier') and opened_by = (select auth.uid()));
create policy "Owner and cashier close sessions" on public.table_sessions for update to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier'))
  with check ((select private.staff_role()) in ('owner', 'cashier'));
revoke insert, update, delete on public.table_sessions from anon, authenticated;
grant insert (table_id) on public.table_sessions to authenticated;         -- pin, opened_by: defaults
grant update (status, closed_reason) on public.table_sessions to authenticated;

-- Payments ----------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id),
  guest_id uuid references public.session_guests(id),     -- null for cash recorded by staff
  payer_name text,
  kind text not null default 'full' check (kind in ('full', 'share')),
  amount int not null check (amount > 0),
  method text not null check (method in ('vietqr', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  reference text,                                          -- transfer note, e.g. 'TBL05 A0421'
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id)
);
create index payments_session_id_idx on public.payments(session_id);
create index payments_guest_id_idx on public.payments(guest_id);
create index payments_confirmed_by_idx on public.payments(confirmed_by);
-- At most one open request per guest: asking again returns the same one (idempotent).
create unique index payments_one_pending_per_guest on public.payments(guest_id) where status = 'pending';

alter table public.payments enable row level security;
create policy "Owner and cashier read payments" on public.payments for select to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier'));
create policy "Owner and cashier record payments" on public.payments for insert to authenticated
  with check ((select private.staff_role()) in ('owner', 'cashier'));
create policy "Owner and cashier confirm payments" on public.payments for update to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier'))
  with check ((select private.staff_role()) in ('owner', 'cashier'));
revoke insert, update, delete on public.payments from anon, authenticated;
grant insert (session_id, payer_name, kind, amount, method, status, reference) on public.payments to authenticated;
grant update (status) on public.payments to authenticated;

-- Restaurant settings (one row) ---------------------------------------------
create table public.restaurant_settings (
  id int primary key default 1 check (id = 1),
  name text not null check (char_length(name) between 1 and 60),
  bank_bin text not null check (bank_bin ~ '^[0-9]{6}$'),       -- NAPAS bank id for VietQR
  account_no text not null check (account_no ~ '^[0-9]{6,19}$'),
  account_name text not null check (account_name ~ '^[A-Z0-9 ]{1,50}$'), -- as the bank prints it
  updated_at timestamptz not null default now()
);
-- No row until the owner enters the real account on O3: guests are sent to the counter meanwhile.
-- (A placeholder account here would reach prod and send guests' money nowhere.) Dev/E2E: seed.sql.

alter table public.restaurant_settings enable row level security;
create policy "Staff read settings" on public.restaurant_settings for select to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier'));
create policy "Owner edits settings" on public.restaurant_settings for update to authenticated
  using ((select private.staff_role()) = 'owner')
  with check ((select private.staff_role()) = 'owner');
revoke insert, update, delete on public.restaurant_settings from anon, authenticated;
grant update (name, bank_bin, account_no, account_name) on public.restaurant_settings to authenticated;

-- Wrong-PIN tracking (server only) -------------------------------------------
create table public.join_attempts (
  id bigint generated always as identity primary key,
  table_id uuid not null references public.tables(id),
  ip text not null,
  created_at timestamptz not null default now()
);
create index join_attempts_recent_idx on public.join_attempts(table_id, created_at);
alter table public.join_attempts enable row level security; -- no policies: service_role only

-- Money helpers -----------------------------------------------------------------
-- Total of all rounds minus confirmed payments, for one session.
create function private.session_remaining(p_session_id uuid)
returns int
language sql stable set search_path = '' as $$
  select coalesce((select sum(o.total) from public.orders o
                   where o.session_id = p_session_id and o.status <> 'cancelled'), 0)
       - coalesce((select sum(p.amount) from public.payments p
                   where p.session_id = p_session_id and p.status = 'confirmed'), 0)
$$;
revoke execute on function private.session_remaining(uuid) from public;
grant execute on function private.session_remaining(uuid) to authenticated, service_role;

-- Business rules on the rows themselves -------------------------------------------
-- Closing: only from open; only when paid, unless the owner gives a reason. Stamps who/when and
-- cancels payment requests that were never confirmed. A closed session never reopens.
create function private.table_sessions_rules()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'SESSION_CLOSED';
  end if;
  if old.status = 'open' and new.status = 'closed' then
    if private.session_remaining(new.id) > 0 then
      if private.staff_role() is distinct from 'owner' then
        raise exception 'UNPAID';
      elsif nullif(btrim(new.closed_reason), '') is null then
        raise exception 'REASON_REQUIRED';
      end if;
    end if;
    new.closed_at := now();
    new.closed_by := auth.uid();
    update public.payments set status = 'cancelled' where session_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger table_sessions_rules before update on public.table_sessions
  for each row execute function private.table_sessions_rules();

-- Payments: a request may only go pending → confirmed | cancelled; confirming stamps who/when.
create function private.payments_rules()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and (old.status <> 'pending' or new.status not in ('confirmed', 'cancelled')) then
    raise exception 'INVALID_PAYMENT_CHANGE';
  end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    new.confirmed_at := now();
    new.confirmed_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger payments_rules before insert or update on public.payments
  for each row execute function private.payments_rules();

revoke execute on function private.table_sessions_rules(), private.payments_rules() from public;

-- Guest side (service_role only) ----------------------------------------------------
-- No more idle expiry: staff own the session lifecycle (ADR 0003).
create or replace function private.guest_session(p_table_code text, p_guest uuid)
returns public.table_sessions
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
begin
  select s.* into v
  from public.session_guests g
  join public.table_sessions s on s.id = g.session_id
  join public.tables t on t.id = s.table_id
  where g.id = p_guest and t.code = p_table_code
  for update of s;
  if not found then
    raise exception 'GUEST_NOT_FOUND';
  end if;
  if v.status <> 'open' then
    raise exception 'SESSION_CLOSED';
  end if;
  return v;
end;
$$;

-- Join needs the open session's PIN. Wrong guesses are limited to 5 per (IP + table) and 30 per
-- table in 10 minutes. A wrong PIN *returns* (not raises) so the recorded attempt is kept.
drop function public.join_table(text, text);
create function public.join_table(p_table_code text, p_name text, p_pin text, p_ip text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_table_id uuid;
  v public.table_sessions;
  v_ip_fails int;
  v_table_fails int;
  v_guest uuid;
  v_name text;
begin
  -- Locking the table row serialises joins on one table, so parallel guesses are counted exactly.
  select t.id into v_table_id from public.tables t where t.code = p_table_code and t.is_active for update;
  if not found then
    raise exception 'TABLE_NOT_FOUND';
  end if;

  select * into v from public.table_sessions s where s.table_id = v_table_id and s.status = 'open';
  if not found then
    raise exception 'TABLE_CLOSED';
  end if;

  select count(*) filter (where a.ip = p_ip), count(*)
    into v_ip_fails, v_table_fails
  from public.join_attempts a
  where a.table_id = v_table_id and a.created_at > now() - interval '10 minutes';
  if v_ip_fails >= 5 or v_table_fails >= 30 then
    raise exception 'TOO_MANY_TRIES';
  end if;

  if p_pin is distinct from v.pin then
    insert into public.join_attempts (table_id, ip) values (v_table_id, coalesce(p_ip, ''));
    return jsonb_build_object('error', 'WRONG_PIN',
      'tries_left', greatest(0, least(5 - v_ip_fails - 1, 30 - v_table_fails - 1)));
  end if;

  v_name := coalesce(
    left(nullif(btrim(p_name), ''), 20),
    'Guest ' || ((select count(*) from public.session_guests g where g.session_id = v.id) + 1));
  insert into public.session_guests (session_id, display_name) values (v.id, v_name) returning id into v_guest;
  update public.table_sessions set last_activity_at = now() where id = v.id;

  return jsonb_build_object('guest_id', v_guest, 'session_id', v.id, 'display_name', v_name);
end;
$$;

-- Same as Phase 4, plus a rate limit: at most 5 rounds per session in 10 minutes.
create or replace function public.place_session_order(p_table_code text, p_guest uuid, p_cart_version int)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
  v_order_id uuid;
  v_line record;
  v_price jsonb;
  v_total int := 0;
  v_last jsonb;
begin
  v := private.guest_session(p_table_code, p_guest);

  if v.cart_version <> p_cart_version then
    if not exists (select 1 from public.cart_items c where c.session_id = v.id) then
      select jsonb_build_object('id', o.id, 'order_no', o.order_no, 'already_sent', true,
                                'sent_by', coalesce(g.display_name, 'Someone'))
        into v_last
      from public.orders o left join public.session_guests g on g.id = o.placed_by
      where o.session_id = v.id order by o.created_at desc limit 1;
      if v_last is not null then
        return v_last;
      end if;
    end if;
    raise exception 'CART_CHANGED';
  end if;
  if not exists (select 1 from public.cart_items c where c.session_id = v.id) then
    raise exception 'CART_EMPTY';
  end if;
  if (select count(*) from public.orders o
      where o.session_id = v.id and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.orders (table_id, session_id, placed_by, total, idempotency_key)
  values (v.table_id, v.id, p_guest, 0, md5(v.id::text || ':' || v.cart_version)::uuid)
  returning id into v_order_id;

  for v_line in
    select * from public.cart_items c where c.session_id = v.id order by c.created_at
  loop
    v_price := private.price_line(v_line.menu_item_id, v_line.size_id, v_line.addon_ids);
    insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price, size_name, addons, note, qty)
    values (v_order_id, v_line.menu_item_id, v_price->>'name', (v_price->>'unit_price')::int,
            v_price->>'size_name', v_price->'addons', v_line.note, v_line.qty);
    v_total := v_total + (v_price->>'unit_price')::int * v_line.qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  delete from public.cart_items where session_id = v.id;
  update public.table_sessions set cart_version = cart_version + 1, last_activity_at = now() where id = v.id;

  return (select jsonb_build_object('id', o.id, 'order_no', o.order_no, 'already_sent', false)
          from public.orders o where o.id = v_order_id);
end;
$$;

-- A guest asks to pay by VietQR: 'full' (what is still open) or 'share' of an equal split.
-- The server computes every amount. One pending request per guest; asking again returns it.
-- Split: split_people is fixed by the first guest who splits; each share is the open amount divided
-- by the people who have not paid yet, rounded down to 1.000đ; the last share takes the rest.
create function public.request_payment(p_table_code text, p_guest uuid, p_mode text, p_people int)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
  v_pending public.payments;
  v_open int;
  v_unpaid int;
  v_amount int;
  v_reference text;
  v_payment public.payments;
begin
  v := private.guest_session(p_table_code, p_guest);

  select * into v_pending from public.payments p where p.guest_id = p_guest and p.status = 'pending';
  if found then
    return to_jsonb(v_pending);
  end if;

  -- Still to pay = bill − confirmed − requests other guests are paying right now.
  v_open := private.session_remaining(v.id)
          - coalesce((select sum(p.amount) from public.payments p where p.session_id = v.id and p.status = 'pending'), 0);
  if v_open <= 0 then
    raise exception 'NOTHING_TO_PAY';
  end if;

  if p_mode = 'full' then
    v_amount := v_open;
  elsif p_mode = 'share' then
    if v.split_people is null then
      if p_people is null or p_people not between 2 and 8 or p_people * 1000 > v_open then
        raise exception 'INVALID_SPLIT';
      end if;
      update public.table_sessions set split_people = p_people where id = v.id;
      v.split_people := p_people;
    end if;
    v_unpaid := v.split_people - (select count(*) from public.payments p
                                  where p.session_id = v.id and p.kind = 'share' and p.status in ('pending', 'confirmed'));
    if v_unpaid <= 1 then
      v_amount := v_open;                                          -- last share: the rest
    else
      -- integer division = round down to 1.000đ; never below 1.000đ, never above what is still open
      v_amount := least(v_open, greatest(1000, (v_open / v_unpaid / 1000) * 1000));
    end if;
  else
    raise exception 'INVALID_MODE';
  end if;

  v_reference := 'TBL' || (select t.code from public.tables t where t.id = v.table_id) || ' '
              || coalesce((select replace(o.order_no, '-', '') from public.orders o
                           where o.session_id = v.id order by o.created_at limit 1), '');
  insert into public.payments (session_id, guest_id, payer_name, kind, amount, method, reference)
  values (v.id, p_guest, (select g.display_name from public.session_guests g where g.id = p_guest),
          case when p_mode = 'share' then 'share' else 'full' end, v_amount, 'vietqr', v_reference)
  returning * into v_payment;
  return to_jsonb(v_payment);
end;
$$;

-- "Pay at the counter instead": the guest withdraws their pending request.
create function public.cancel_payment(p_table_code text, p_guest uuid)
returns void
language plpgsql set search_path = '' as $$
begin
  perform private.guest_session(p_table_code, p_guest);
  update public.payments set status = 'cancelled' where guest_id = p_guest and status = 'pending';
end;
$$;

revoke execute on function public.join_table(text, text, text, text), public.request_payment(text, uuid, text, int),
  public.cancel_payment(text, uuid) from public, anon, authenticated;
grant execute on function public.join_table(text, text, text, text), public.request_payment(text, uuid, text, int),
  public.cancel_payment(text, uuid) to service_role;

-- Staff side ----------------------------------------------------------------------
-- "Paid in cash": settles everything still open in one confirmed cash payment and withdraws any
-- VietQR requests (the guests paid at the counter instead). Runs as the staff member (RLS applies).
create function public.record_cash_payment(p_session_id uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_amount int;
  v_payment public.payments;
begin
  if private.staff_role() is distinct from 'owner' and private.staff_role() is distinct from 'cashier' then
    raise exception 'NOT_ALLOWED';
  end if;
  perform 1 from public.table_sessions s where s.id = p_session_id and s.status = 'open' for update;
  if not found then
    raise exception 'SESSION_CLOSED';
  end if;
  update public.payments set status = 'cancelled' where session_id = p_session_id and status = 'pending';
  v_amount := private.session_remaining(p_session_id);
  if v_amount <= 0 then
    raise exception 'NOTHING_TO_PAY';
  end if;
  insert into public.payments (session_id, payer_name, kind, amount, method, status)
  values (p_session_id, 'Cash at the counter', 'full', v_amount, 'cash', 'confirmed')
  returning * into v_payment;
  return to_jsonb(v_payment);
end;
$$;
revoke execute on function public.record_cash_payment(uuid) from public, anon;
grant execute on function public.record_cash_payment(uuid) to authenticated;

-- Realtime: S1 and C2 follow sessions and payments live (RLS limits events to owner/cashier).
alter publication supabase_realtime add table public.table_sessions, public.payments;
