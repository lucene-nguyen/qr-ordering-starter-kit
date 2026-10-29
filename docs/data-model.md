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
| 3 | `staff_profiles`, `private.staff_role()`, staff RLS + column grants, realtime publication (`20261028200000_phase3_staff_kitchen.sql`, `20261028201000_private_staff_role.sql`; see ADR 0002) |
| 4 | `table_sessions` (+`cart_version`, `last_activity_at`), `session_guests`, `cart_items` (one row per guest per exact choice, `nulls not distinct`), `orders.session_id` FK + `placed_by`; functions `join_table`, `cart_add`, `cart_change`, `place_session_order`, `private.price_line` (`20261028300000_phase4_shared_cart.sql`, `20261028301000_cart_add_qty_check.sql`). No `version` column: quantity changes are atomic deltas. |
| 5 | `table_sessions` + `pin`, `opened_by`, `closed_by`, `closed_reason`, `split_people`; `payments`, `restaurant_settings`, `join_attempts`; functions `join_table` (PIN), `request_payment`, `cancel_payment`, `record_cash_payment`, `guest_payment_qr`, `private.session_remaining`; triggers `table_sessions_rules`, `payments_rules` (`20261028400000_phase5_sessions_payments.sql`, `20261028401000_guest_payment_qr.sql`, `20261028402000_owner_adds_settings.sql`; ADR 0003) |
| 5 fix | `request_payment` raises `NO_BANK_ACCOUNT` without a `restaurant_settings` row; function `guest_bill` (amount still owed + `bank_ready`, `service_role` only) (`20261029141025_no_bank_account.sql`, LEARNING-100) |
| 6 | functions `report_revenue(from, to, grain)`, `report_items(from, to)`, `report_hours(from, to)`: security invoker, owner only (`NOT_ALLOWED` otherwise), dates grouped in Asia/Ho_Chi_Minh; partial index `table_sessions(closed_at) where status = 'closed'` (`20261029150739_phase6_reports.sql`; ADR 0004). Functions instead of views: a cashier can read `payments` through RLS, so the owner check has to sit inside. |

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

-- Phase 3 ---------------------------------------------------------------
create table staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'cashier', 'kitchen'))
);

-- Phase 5 (as built) ------------------------------------------------------
alter table table_sessions
  add column pin text not null default <random 4 digits>,   -- told to guests by staff; ends with the session
  add column opened_by uuid default auth.uid(),              -- staff who opened it
  add column closed_by uuid,                                 -- stamped by the trigger
  add column closed_reason text,                             -- required when the owner force-closes unpaid
  add column split_people int check (split_people between 2 and 8);  -- fixed by the first guest who splits

create table payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id),
  guest_id uuid references session_guests(id),               -- null for cash recorded by staff
  payer_name text,
  kind text not null default 'full' check (kind in ('full', 'share')),
  amount int not null check (amount > 0),                    -- computed by the database only
  method text not null check (method in ('vietqr', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  reference text,                                            -- transfer note 'TBL05 A0421'
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,                                  -- stamped by the trigger
  confirmed_by uuid                                          -- stamped by the trigger
);
create unique index payments_one_pending_per_guest on payments(guest_id) where status = 'pending';

create table restaurant_settings (                           -- no row until the owner fills in O3
  id int primary key default 1 check (id = 1),               -- single row
  name text not null,
  bank_bin text not null check (bank_bin ~ '^[0-9]{6}$'),    -- NAPAS BIN for VietQR
  account_no text not null check (account_no ~ '^[0-9]{6,19}$'),
  account_name text not null check (account_name ~ '^[A-Z0-9 ]{1,50}$'),
  updated_at timestamptz not null default now()
);

create table join_attempts (                                 -- wrong PINs, service_role only
  id bigint generated always as identity primary key,
  table_id uuid not null references tables(id),
  ip text not null,
  created_at timestamptz not null default now()
);
```

## Row Level Security plan

- Enable RLS on **every** table.
- `categories`, `menu_items`, sizes, add-ons, `tables`: `select` for everyone; writes for `owner`/`cashier` (sold-out toggle also `kitchen`).
- `orders`, `order_items`: `select` for staff roles; guests read their own session's orders through Server Actions only.
- `table_sessions`, `payments`: read by `owner`/`cashier`. Staff open sessions (insert `table_id` only;
  PIN and `opened_by` are defaults), close them (update `status`, `closed_reason`) and confirm payments
  (update `status`) as themselves.
- `restaurant_settings`: read by `owner`/`cashier`; added and changed by `owner` only (column grants).
- `join_attempts`: no policies (service_role only).
- Business rules live in BEFORE triggers, so they also hold for direct API calls:
  `table_sessions_rules` (close only when paid, unless the owner gives a reason; stamps
  `closed_at`/`closed_by`; cancels pending payments; a closed session never reopens) and
  `payments_rules` (only pending → confirmed | cancelled; stamps `confirmed_at`/`confirmed_by`).
- Guest functions (`join_table`, `cart_*`, `place_session_order`, `request_payment`,
  `cancel_payment`) are executable by `service_role` only; Server Actions call them after checking
  the `tt_guest` cookie. `guest_payment_qr` is executable by `anon` and answers only for the
  caller's own pending payment in an open session.
- Reports: `report_revenue`, `report_items` and `report_hours` run as the caller (RLS applies) and
  raise `NOT_ALLOWED` unless `private.staff_role() = 'owner'`. They are executable by `authenticated`
  only, not `anon`. Revenue rules are in ADR 0004.
- Helper: `private.staff_role()` reading `staff_profiles` for `auth.uid()` (Phase 3). Staff `update` is limited per column: `orders.status`, `menu_items.is_available`.

## Seed data

Use the prototype's menu (Phở bò tái 65.000đ, Bún chả Hà Nội 60.000đ, … ) and tables 01–12 in
`supabase/seed.sql` so screens match the prototype.
