-- LEARNING-100 · fix from the Phase 5 smoke test: no bank account → no VietQR request.
--
-- With no restaurant_settings row, request_payment still created a pending 'vietqr' payment. C2 then
-- showed "Awaiting · VietQR" with Confirm received (prod: a 15.000đ transfer was confirmed that never
-- happened), and "Paid in cash" asked about a transfer that could not exist.
-- Now the database refuses (NO_BANK_ACCOUNT) and the guest is sent to the counter without a payment.

-- Same as 20261028400000, plus the NO_BANK_ACCOUNT check right after the session check.
create or replace function public.request_payment(p_table_code text, p_guest uuid, p_mode text, p_people int)
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

  if not exists (select 1 from public.restaurant_settings) then
    raise exception 'NO_BANK_ACCOUNT';
  end if;

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

-- 05 · what the guest's pay screen needs before offering VietQR: what is still owed (bill − confirmed)
-- and whether the restaurant can take transfers at all. Called by the server with the secret key,
-- after the guest cookie check; it only returns a number and a yes/no, never bank details.
create function public.guest_bill(p_table_code text, p_guest uuid)
returns table (amount_open int, bank_ready boolean)
language plpgsql set search_path = '' as $$
declare
  v public.table_sessions;
begin
  v := private.guest_session(p_table_code, p_guest);
  return query
  select private.session_remaining(v.id), exists (select 1 from public.restaurant_settings);
end;
$$;
revoke execute on function public.guest_bill(text, uuid) from public, anon, authenticated;
grant execute on function public.guest_bill(text, uuid) to service_role;
