-- LEARNING-98 · Phase 4 – shared cart per table session
-- Guests stay anonymous (ADR 0002): only the server (service_role) calls these functions, after
-- reading the httpOnly guest cookie. A session id is never a credential on its own.

-- Shared helpers (private schema: not exposed by the API) -------------------
grant usage on schema private to service_role;

-- trim; empty → null. Used before storing and before comparing notes.
create function private.clean_note(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(btrim(p), '')
$$;

-- Sorted, de-duplicated add-on ids, so the same choice always looks the same.
create function private.sort_ids(p uuid[]) returns uuid[]
language sql immutable set search_path = '' as $$
  select coalesce(array(select distinct x from unnest(p) as x order by x), '{}')
$$;

-- Prices one cart line from the database (base + size + add-ons) and validates the choice.
-- The single pricing rule for every order path.
create function private.price_line(p_menu_item_id uuid, p_size_id uuid, p_addon_ids uuid[])
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_item public.menu_items;
  v_size public.menu_item_sizes;
  v_addons jsonb;
  v_addon_total int;
  v_addon_count int;
begin
  select * into v_item from public.menu_items m where m.id = p_menu_item_id;
  if not found then
    raise exception 'ITEM_UNAVAILABLE';
  end if;
  if not v_item.is_available then
    raise exception 'ITEM_UNAVAILABLE: %', v_item.name;
  end if;

  -- Size: required when the dish has sizes, and it must belong to this dish.
  if p_size_id is not null then
    select * into v_size from public.menu_item_sizes s where s.id = p_size_id and s.menu_item_id = v_item.id;
    if not found then
      raise exception 'INVALID_OPTION';
    end if;
  elsif exists (select 1 from public.menu_item_sizes s where s.menu_item_id = v_item.id) then
    raise exception 'INVALID_OPTION';
  end if;

  -- Add-ons: every id must belong to this dish.
  select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'extra_price', a.extra_price) order by a.sort), '[]'::jsonb),
         coalesce(sum(a.extra_price), 0),
         count(*)
    into v_addons, v_addon_total, v_addon_count
  from public.menu_item_addons a
  where a.menu_item_id = v_item.id and a.id = any (p_addon_ids);
  if v_addon_count <> coalesce(cardinality(private.sort_ids(p_addon_ids)), 0) then
    raise exception 'INVALID_OPTION';
  end if;

  return jsonb_build_object(
    'name', v_item.name,
    'unit_price', v_item.price + coalesce(v_size.extra_price, 0) + v_addon_total,
    'size_name', v_size.name,
    'addons', v_addons);
end;
$$;

revoke execute on function private.clean_note(text), private.sort_ids(uuid[]),
  private.price_line(uuid, uuid, uuid[]) from public;
grant execute on function private.clean_note(text), private.sort_ids(uuid[]),
  private.price_line(uuid, uuid, uuid[]) to service_role;

-- Sessions, guests, cart -------------------------------------------------
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  cart_version int not null default 0              -- +1 on every cart change and every order
);
create unique index one_open_session_per_table on public.table_sessions(table_id) where status = 'open';

create table public.session_guests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  joined_at timestamptz not null default now()
);
create index session_guests_session_id_idx on public.session_guests(session_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  size_id uuid references public.menu_item_sizes(id),
  addon_ids uuid[] not null default '{}',          -- sorted (private.sort_ids)
  note text check (note is null or (note = btrim(note) and note <> '' and char_length(note) <= 80)),
  qty int not null check (qty between 1 and 50),
  added_by uuid not null references public.session_guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One row per guest per exact choice: the same guest adding it again merges, another guest gets
-- their own row (so "Added by" stays true). NULL size/note count as equal.
create unique index cart_items_choice_key on public.cart_items
  (session_id, menu_item_id, size_id, addon_ids, note, added_by) nulls not distinct;
create index cart_items_menu_item_id_idx on public.cart_items(menu_item_id);
create index cart_items_size_id_idx on public.cart_items(size_id);
create index cart_items_added_by_idx on public.cart_items(added_by);

alter table public.orders
  add constraint orders_session_id_fkey foreign key (session_id) references public.table_sessions(id),
  add column placed_by uuid references public.session_guests(id);
create index orders_session_id_idx on public.orders(session_id);
create index orders_placed_by_idx on public.orders(placed_by);

-- RLS: guests never touch these tables directly; staff may read (checkout comes in Phase 5).
alter table public.table_sessions enable row level security;
alter table public.session_guests enable row level security;
alter table public.cart_items enable row level security;
create policy "Staff read sessions" on public.table_sessions for select to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier', 'kitchen'));
create policy "Staff read guests" on public.session_guests for select to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier', 'kitchen'));
create policy "Staff read carts" on public.cart_items for select to authenticated
  using ((select private.staff_role()) in ('owner', 'cashier', 'kitchen'));

-- The guest's open session at this table, locked so cart changes on one table run one at a time.
-- shortcut: sessions open on first join and expire after 4 h idle; staff open/close them in Phase 5.
create function private.guest_session(p_table_code text, p_guest uuid)
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
  if v.status <> 'open' or v.last_activity_at < now() - interval '4 hours' then
    raise exception 'SESSION_CLOSED';
  end if;
  return v;
end;
$$;
revoke execute on function private.guest_session(text, uuid) from public;
grant execute on function private.guest_session(text, uuid) to service_role;

-- Guest functions (service_role only) ------------------------------------

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

-- Add a line. Same guest + same choice merges (qty adds up, capped at 50). Returns cart_version.
create function public.cart_add(p_table_code text, p_guest uuid, p_line jsonb)
returns int
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
  v_addons uuid[] := private.sort_ids(coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(p_line->'addon_ids') x), '{}'));
begin
  v := private.guest_session(p_table_code, p_guest);
  perform private.price_line((p_line->>'menu_item_id')::uuid, (p_line->>'size_id')::uuid, v_addons);

  insert into public.cart_items (session_id, menu_item_id, size_id, addon_ids, note, qty, added_by)
  values (v.id, (p_line->>'menu_item_id')::uuid, (p_line->>'size_id')::uuid, v_addons,
          private.clean_note(p_line->>'note'), least((p_line->>'qty')::int, 50), p_guest)
  on conflict (session_id, menu_item_id, size_id, addon_ids, note, added_by)
  do update set qty = least(public.cart_items.qty + excluded.qty, 50), updated_at = now();

  update public.table_sessions set cart_version = cart_version + 1, last_activity_at = now()
  where id = v.id returning cart_version into v.cart_version;
  return v.cart_version;
end;
$$;

-- Change a line by a delta (+1 / −1). Deltas from two phones add up instead of overwriting each
-- other; reaching 0 removes the line. A line someone else already removed is a no-op.
create function public.cart_change(p_table_code text, p_guest uuid, p_item uuid, p_delta int)
returns int
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
begin
  if p_delta not between -50 and 50 or p_delta = 0 then
    raise exception 'INVALID_DELTA';
  end if;
  v := private.guest_session(p_table_code, p_guest); -- locks the session: changes run one at a time

  delete from public.cart_items where id = p_item and session_id = v.id and qty + p_delta <= 0;
  if not found then
    update public.cart_items set qty = least(qty + p_delta, 50), updated_at = now()
    where id = p_item and session_id = v.id;
  end if;

  update public.table_sessions set cart_version = cart_version + 1, last_activity_at = now()
  where id = v.id returning cart_version into v.cart_version;
  return v.cart_version;
end;
$$;

-- Send the whole shared cart to the kitchen as one round.
-- p_cart_version is the version the guest saw. If it moved on:
--   cart now empty → someone just sent it: return that order (already_sent) instead of a second one;
--   cart still has items → it changed under the guest: CART_CHANGED, nothing is created.
create function public.place_session_order(p_table_code text, p_guest uuid, p_cart_version int)
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

  -- The key is derived from (session, version): one cart version can only ever become one order.
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

revoke execute on function public.join_table(text, text), public.cart_add(text, uuid, jsonb),
  public.cart_change(text, uuid, uuid, int), public.place_session_order(text, uuid, int)
  from public, anon, authenticated;
grant execute on function public.join_table(text, text), public.cart_add(text, uuid, jsonb),
  public.cart_change(text, uuid, uuid, int), public.place_session_order(text, uuid, int)
  to service_role;

-- place_order (Phase 2) now prices through the same helper ---------------
create or replace function public.place_order(p_table_code text, p_idempotency_key uuid, p_lines jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_table_id uuid;
  v_order_id uuid;
  v_line jsonb;
  v_price jsonb;
  v_qty int;
  v_total int := 0;
begin
  select o.id into v_order_id from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    return (select jsonb_build_object('id', o.id, 'order_no', o.order_no) from public.orders o where o.id = v_order_id);
  end if;

  select t.id into v_table_id from public.tables t where t.code = p_table_code and t.is_active;
  if not found then
    raise exception 'TABLE_NOT_FOUND';
  end if;

  insert into public.orders (table_id, total, idempotency_key)
  values (v_table_id, 0, p_idempotency_key)
  on conflict (idempotency_key) do nothing
  returning id into v_order_id;
  if v_order_id is null then
    return (select jsonb_build_object('id', o.id, 'order_no', o.order_no) from public.orders o where o.idempotency_key = p_idempotency_key);
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_price := private.price_line(
      (v_line->>'menu_item_id')::uuid,
      (v_line->>'size_id')::uuid,
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(v_line->'addon_ids') x), '{}'));
    v_qty := (v_line->>'qty')::int;
    insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price, size_name, addons, note, qty)
    values (v_order_id, (v_line->>'menu_item_id')::uuid, v_price->>'name', (v_price->>'unit_price')::int,
            v_price->>'size_name', v_price->'addons', private.clean_note(v_line->>'note'), v_qty);
    v_total := v_total + (v_price->>'unit_price')::int * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return (select jsonb_build_object('id', o.id, 'order_no', o.order_no) from public.orders o where o.id = v_order_id);
end;
$$;
