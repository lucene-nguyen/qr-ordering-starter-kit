-- LEARNING-99 · Phase 5 – O3: the owner enters the bank account. There is no settings row until
-- then (no placeholder account), so the owner must be able to add the first one. id defaults to 1
-- and is checked = 1, so there is still at most one row.
create policy "Owner adds settings" on public.restaurant_settings for insert to authenticated
  with check ((select private.staff_role()) = 'owner');
grant insert (name, bank_bin, account_no, account_name) on public.restaurant_settings to authenticated;
