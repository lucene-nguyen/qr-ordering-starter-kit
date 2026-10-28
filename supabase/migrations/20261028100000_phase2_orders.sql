-- LEARNING-96 · Phase 2 – cart and order submission

-- Item options ----------------------------------------------------------
create table public.menu_item_sizes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,                              -- Regular, Large
  extra_price int not null default 0 check (extra_price >= 0),
  sort int not null default 0
);
create index menu_item_sizes_item_idx on public.menu_item_sizes(menu_item_id);

create table public.menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,                              -- Extra beef
  extra_price int not null default 0 check (extra_price >= 0),
  sort int not null default 0
);
create index menu_item_addons_item_idx on public.menu_item_addons(menu_item_id);

alter table public.menu_item_sizes enable row level security;
alter table public.menu_item_addons enable row level security;
create policy "Sizes are public" on public.menu_item_sizes for select to anon, authenticated using (true);
create policy "Add-ons are public" on public.menu_item_addons for select to anon, authenticated using (true);

-- Orders ----------------------------------------------------------------
create type public.order_status as enum ('pending', 'preparing', 'ready', 'served', 'cancelled');
create sequence public.order_no_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default 'A-' || lpad(nextval('public.order_no_seq')::text, 4, '0'),
  table_id uuid not null references public.tables(id),
  session_id uuid,                                 -- FK added in Phase 4/5
  status public.order_status not null default 'pending',
  total int not null check (total >= 0),           -- computed on the server
  idempotency_key uuid not null unique,            -- double-tap / retry protection
  created_at timestamptz not null default now()
);
create index orders_table_id_idx on public.orders(table_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  name_snapshot text not null,                     -- name at order time
  unit_price int not null check (unit_price >= 0), -- base + size + add-ons at order time
  size_name text,
  addons jsonb not null default '[]',              -- [{name, extra_price}]
  note text,
  qty int not null check (qty > 0)
);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_menu_item_id_idx on public.order_items(menu_item_id);

-- RLS on, no policies: guests never touch orders directly. The server writes and reads them
-- with the secret key after its own checks; staff policies arrive with the kitchen (Phase 3).
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- place_order -----------------------------------------------------------
-- Creates one order atomically: prices come from the database (never from the client),
-- dish name and price are snapshotted, and a repeated idempotency key returns the first order.
-- p_lines: [{ "menu_item_id", "size_id" | null, "addon_ids": [], "note", "qty" }]
create function public.place_order(p_table_code text, p_idempotency_key uuid, p_lines jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_table_id uuid;
  v_order_id uuid;
  v_line jsonb;
  v_item public.menu_items;
  v_size public.menu_item_sizes;
  v_addons jsonb;
  v_addon_total int;
  v_addon_count int;
  v_qty int;
  v_unit int;
  v_total int := 0;
begin
  -- A retry of a request we already handled: answer with the same order.
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
    -- A concurrent request with the same key committed first.
    return (select jsonb_build_object('id', o.id, 'order_no', o.order_no) from public.orders o where o.idempotency_key = p_idempotency_key);
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_item from public.menu_items m where m.id = (v_line->>'menu_item_id')::uuid;
    if not found then
      raise exception 'ITEM_UNAVAILABLE';
    end if;
    if not v_item.is_available then
      raise exception 'ITEM_UNAVAILABLE: %', v_item.name;
    end if;

    -- Size: required when the dish has sizes, and it must belong to this dish.
    v_size := null;
    if v_line->>'size_id' is not null then
      select * into v_size from public.menu_item_sizes s
      where s.id = (v_line->>'size_id')::uuid and s.menu_item_id = v_item.id;
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
    where a.menu_item_id = v_item.id
      and a.id in (select x::uuid from jsonb_array_elements_text(v_line->'addon_ids') x);
    if v_addon_count <> (select count(distinct x) from jsonb_array_elements_text(v_line->'addon_ids') x) then
      raise exception 'INVALID_OPTION';
    end if;

    v_qty := (v_line->>'qty')::int;
    v_unit := v_item.price + coalesce(v_size.extra_price, 0) + v_addon_total;
    insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price, size_name, addons, note, qty)
    values (v_order_id, v_item.id, v_item.name, v_unit, v_size.name, v_addons, nullif(btrim(v_line->>'note'), ''), v_qty);
    v_total := v_total + v_unit * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return (select jsonb_build_object('id', o.id, 'order_no', o.order_no) from public.orders o where o.id = v_order_id);
end;
$$;

-- Only the server (secret key → service_role) may place orders.
revoke execute on function public.place_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(text, uuid, jsonb) to service_role;
