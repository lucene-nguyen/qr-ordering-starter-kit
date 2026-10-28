-- LEARNING-97 · Phase 3 – staff sign-in, kitchen access, realtime (see docs/decisions/0002)

-- Staff ----------------------------------------------------------------
create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'cashier', 'kitchen'))
);
alter table public.staff_profiles enable row level security;
create policy "Staff read own profile" on public.staff_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- Role of the signed-in user, or null. Security definer so policies can call it without
-- tripping over staff_profiles' own RLS.
create function public.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_profiles where user_id = auth.uid()
$$;
revoke execute on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

-- Staff access to orders -----------------------------------------------
-- `(select …)` makes Postgres evaluate the role once per query instead of once per row.
create policy "Staff read orders" on public.orders
  for select to authenticated
  using ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'));
create policy "Staff read order items" on public.order_items
  for select to authenticated
  using ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'));
create policy "Staff update order status" on public.orders
  for update to authenticated
  using ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'))
  with check ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'));
create policy "Staff toggle dish availability" on public.menu_items
  for update to authenticated
  using ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'))
  with check ((select public.staff_role()) in ('owner', 'cashier', 'kitchen'));

-- Column privileges: RLS picks the rows, grants pick the columns. Staff can change an order's
-- status and a dish's sold-out flag – never prices, totals or names.
revoke update on public.orders, public.menu_items from anon, authenticated;
grant update (status) on public.orders to authenticated;
grant update (is_available) on public.menu_items to authenticated;

-- Realtime -------------------------------------------------------------
-- orders: kitchen board (RLS limits it to staff). menu_items: guests' menus refresh on sold-out.
alter publication supabase_realtime add table public.orders, public.menu_items;
