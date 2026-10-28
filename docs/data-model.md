# Data model (proposed)

Starting point for the Supabase schema. Each phase turns its part into a migration in
`supabase/migrations/` – adjust as you learn and record big changes in `docs/decisions/`.

Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` in UTC, money as
`integer` VND, `snake_case` names.

## Tables by phase

| Phase | Tables |
|---|---|
| 1 | `categories`, `menu_items`, `tables` (migration `20261028000000_phase1_menu.sql`) |
| 2 | `menu_item_sizes`, `menu_item_addons`, `orders`, `order_items`, function `place_order` (migration `20261028100000_phase2_orders.sql`) |
| 4 | `table_sessions`, `session_guests`, `cart_items` |
| 5 | `payments`, `staff_profiles`, `restaurant_settings`; `orders.session_id` becomes required |
| 6 | views `daily_revenue`, `item_sales` |

```sql
-- Phase 1 ---------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  description text,
  price int not null check (price >= 0),          -- VND
  image_url text,
  is_available boolean not null default true,     -- "sold out" toggle
  is_popular boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table menu_item_sizes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,                              -- Regular, Large
  extra_price int not null default 0,
  sort int not null default 0
);

create table menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,                              -- Extra beef
  extra_price int not null default 0,
  sort int not null default 0
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- '05' – used in /t/05
  label text not null,                             -- 'Table 05'
  is_active boolean not null default true
);

-- Phase 2 ---------------------------------------------------------------
create type order_status as enum ('pending', 'preparing', 'ready', 'served', 'cancelled');

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,                   -- 'A-0421'
  table_id uuid not null references tables(id),
  session_id uuid,                                 -- FK added in Phase 4/5
  status order_status not null default 'pending',
  total int not null,                              -- computed on the server
  idempotency_key uuid not null unique,            -- double-tap protection
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  name_snapshot text not null,                     -- name at order time
  unit_price int not null,                         -- base + size + add-ons at order time
  size_name text,
  addons jsonb not null default '[]',              -- [{name, extra_price}]
  note text,
  qty int not null check (qty > 0)
);

-- Phase 4 ---------------------------------------------------------------
create table table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id),
  token text not null unique,                      -- in the QR link, rotates on close
  status text not null check (status in ('open', 'closed')) default 'open',
  opened_by uuid,                                  -- staff user (Phase 5)
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index one_open_session_per_table on table_sessions(table_id) where status = 'open';

create table session_guests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  size_id uuid references menu_item_sizes(id),
  addon_ids uuid[] not null default '{}',
  note text,
  qty int not null check (qty > 0),
  added_by uuid references session_guests(id),
  version int not null default 1,                  -- optimistic concurrency
  updated_at timestamptz not null default now()
);

-- Phase 5 ---------------------------------------------------------------
create table staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'cashier', 'kitchen'))
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id),
  payer_name text,
  amount int not null check (amount > 0),
  method text not null check (method in ('vietqr', 'cash')),
  status text not null check (status in ('pending', 'confirmed')) default 'pending',
  reference text,                                   -- transfer note, e.g. 'TBL05 A0421'
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table restaurant_settings (
  id int primary key default 1 check (id = 1),     -- single row
  name text not null,
  bank_bin text not null,                          -- NAPAS bank code for VietQR
  account_no text not null,
  account_name text not null
);
```

## Row Level Security plan

- Enable RLS on **every** table.
- `categories`, `menu_items`, sizes, add-ons, `tables`: `select` for everyone; writes for `owner`/`cashier` (sold-out toggle also `kitchen`).
- `orders`, `order_items`: `select` for staff roles; guests read their own session's orders through Server Actions only.
- `table_sessions`, `payments`: staff only (`owner`, `cashier`).
- Reports views: `owner` only.
- Helper: `create function public.staff_role() returns text` reading `staff_profiles` for `auth.uid()`.

## Seed data

Use the prototype's menu (Phở bò tái 65.000đ, Bún chả Hà Nội 60.000đ, … ) and tables 01–12 in
`supabase/seed.sql` so screens match the prototype.
