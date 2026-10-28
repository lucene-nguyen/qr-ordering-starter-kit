-- LEARNING-95 · Phase 1 – table-based menu
-- Sizes and add-ons (menu_item_sizes, menu_item_addons) arrive with the item options in Phase 2.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name text not null,
  description text,
  price int not null check (price >= 0),          -- VND
  image_url text,
  is_available boolean not null default true,     -- "sold out" toggle
  is_popular boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index menu_items_category_id_idx on public.menu_items(category_id);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- '05' – used in /t/05 and printed in the QR
  label text not null,                             -- 'Table 05'
  is_active boolean not null default true
);

-- RLS: guests (anon) may only read. No write policies yet, so writes with the
-- publishable key are denied; staff writes come with Supabase Auth in Phase 3/5.
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.tables enable row level security;

create policy "Menu is public" on public.categories for select to anon, authenticated using (true);
create policy "Dishes are public" on public.menu_items for select to anon, authenticated using (true);
create policy "Active tables are public" on public.tables for select to anon, authenticated using (is_active);
