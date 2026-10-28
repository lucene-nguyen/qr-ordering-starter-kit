-- LEARNING-99 · Phase 5 – what a guest's phone needs to draw the VietQR (screen 05).
--
-- Guests are anonymous and have no RLS access to payments or restaurant_settings. Instead of
-- reading those with the secret key, the server asks this one function with the publishable key.
-- It answers only for a PENDING payment of THIS guest (the tt_guest cookie id), in an OPEN session
-- of this table; anything else is NOT_FOUND, so it cannot be used to read other guests' payments.
-- The bank columns are null when no settings row exists: the guest is sent to the counter.
create function public.guest_payment_qr(p_table_code text, p_guest uuid, p_payment uuid)
returns table (bin text, account_no text, account_name text, amount int, reference text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select rs.bank_bin, rs.account_no, rs.account_name, p.amount, p.reference
  from public.payments p
  join public.table_sessions s on s.id = p.session_id
  join public.tables t on t.id = s.table_id
  left join public.restaurant_settings rs on rs.id = 1
  where p.id = p_payment and p.guest_id = p_guest and p.status = 'pending'
    and s.status = 'open' and t.code = p_table_code;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;
revoke execute on function public.guest_payment_qr(text, uuid, uuid) from public, authenticated;
grant execute on function public.guest_payment_qr(text, uuid, uuid) to anon;
