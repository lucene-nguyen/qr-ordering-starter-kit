-- Phase 5 (LEARNING-99) database tests – run on DEV only (SQL Editor of tabletap-dev).
-- Everything runs in one DO block and ends with `raise exception 'ALL_OK'`, which rolls the whole
-- block back: seeing "ERROR: ALL_OK" means every assert passed and nothing was left behind.
-- Any other error names the failing check (A1…H6).
-- Needs: seed.sql (menu, tables, the demo restaurant_settings row) and the staff accounts hoa@ (owner), an@ (cashier), bep@ (kitchen),
-- and tables 03, 06, 07, 08 without an open session.
-- Staff are simulated with `set local role authenticated` + their JWT claims, so RLS, column grants
-- and triggers apply exactly as for a real signed-in user; guests go through the service functions.

do $$
declare
  own uuid := (select id from auth.users where email = 'hoa@phomay.example');
  cas uuid := (select id from auth.users where email = 'an@phomay.example');
  kit uuid := (select id from auth.users where email = 'bep@phomay.example');
  pho uuid := (select id from menu_items where name = 'Phở bò tái');
  pho_reg uuid := (select s.id from menu_item_sizes s join menu_items m on m.id = s.menu_item_id where m.name = 'Phở bò tái' and s.name = 'Regular');
  bun uuid := (select id from menu_items where name = 'Bún chả Hà Nội');
  bun_reg uuid := (select s.id from menu_item_sizes s join menu_items m on m.id = s.menu_item_id where m.name = 'Bún chả Hà Nội' and s.name = 'Regular');
  t03 uuid := (select id from tables where code = '03');
  t06 uuid := (select id from tables where code = '06');
  t07 uuid := (select id from tables where code = '07');
  t08 uuid := (select id from tables where code = '08');
  s03 public.table_sessions; s06 public.table_sessions; s07 public.table_sessions; s08 public.table_sessions;
  r jsonb; g1 uuid; g2 uuid; g3 uuid; p1 jsonb; p2 jsonb; p3 jsonb;
  ok boolean; n int; i int; ver int;
begin
  ------------------------------------------------------------ A. opening sessions (AC2)
  perform set_config('request.jwt.claims', json_build_object('sub', kit, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into public.table_sessions (table_id) values (t03); ok := false;
  exception when insufficient_privilege then ok := true; end;
  execute 'reset role';
  assert ok, 'A1 kitchen cannot open a session';

  perform set_config('request.jwt.claims', json_build_object('sub', cas, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.table_sessions (table_id) values (t03) returning * into s03;
  begin insert into public.table_sessions (table_id) values (t03); ok := false;
  exception when unique_violation then ok := true; end;
  assert ok, 'A3 cannot open an already open table';
  begin insert into public.table_sessions (table_id, pin) values (t06, '0000'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'A4 staff cannot choose the PIN';
  insert into public.table_sessions (table_id) values (t06) returning * into s06;
  insert into public.table_sessions (table_id) values (t07) returning * into s07;
  insert into public.table_sessions (table_id) values (t08) returning * into s08;
  execute 'reset role';
  assert s03.opened_by = cas and s03.pin ~ '^[0-9]{4}$', 'A2 cashier opens: opened_by stamped, 4-digit PIN';

  ------------------------------------------------------------ B. join with PIN + lockout
  begin perform public.join_table('04', 'X', '1234', 'ip-a'); ok := false;
  exception when others then ok := sqlerrm = 'TABLE_CLOSED'; end;
  assert ok, 'B1 no open session -> TABLE_CLOSED';
  for i in 1..5 loop
    r := public.join_table('03', 'X', case when s03.pin = '0000' then '1111' else '0000' end, 'ip-a');
    assert r->>'error' = 'WRONG_PIN' and (r->>'tries_left')::int = 5 - i, format('B2 wrong PIN #%s, tries_left %s', i, r->>'tries_left');
  end loop;
  begin perform public.join_table('03', 'X', s03.pin, 'ip-a'); ok := false;
  exception when others then ok := sqlerrm = 'TOO_MANY_TRIES'; end;
  assert ok, 'B3 6th try from the same IP is locked, even with the right PIN';
  r := public.join_table('03', 'Lan', s03.pin, 'ip-b');
  assert r ? 'guest_id' and (r->>'session_id')::uuid = s03.id, 'B4 another IP (a real guest) still joins';
  g1 := (r->>'guest_id')::uuid;
  for i in 1..30 loop perform public.join_table('06', 'X', case when s06.pin = '0000' then '1111' else '0000' end, 'ip-' || i); end loop;
  begin perform public.join_table('06', 'X', s06.pin, 'ip-new'); ok := false;
  exception when others then ok := sqlerrm = 'TOO_MANY_TRIES'; end;
  assert ok, 'B5 30 wrong guesses per table lock the table for 10 min';

  ------------------------------------------------------------ C. rate limit
  for i in 1..6 loop
    perform public.cart_add('03', g1, jsonb_build_object('menu_item_id', pho, 'size_id', pho_reg, 'addon_ids', '[]'::jsonb, 'qty', 1));
    ver := (select cart_version from table_sessions where id = s03.id);
    begin perform public.place_session_order('03', g1, ver); ok := i <= 5;
    exception when others then ok := i = 6 and sqlerrm = 'RATE_LIMITED'; end;
    assert ok, format('C1 round %s: 5 allowed, the 6th RATE_LIMITED', i);
  end loop;

  ------------------------------------------------------------ D. split 250.000 / 3 and closing (AC1, AC4)
  g1 := (public.join_table('07', 'Lan', s07.pin, 'ip-c')->>'guest_id')::uuid;
  g2 := (public.join_table('07', 'Minh', s07.pin, 'ip-c')->>'guest_id')::uuid;
  g3 := (public.join_table('07', 'Hoa', s07.pin, 'ip-c')->>'guest_id')::uuid;
  perform public.cart_add('07', g1, jsonb_build_object('menu_item_id', pho, 'size_id', pho_reg, 'addon_ids', '[]'::jsonb, 'qty', 2));
  perform public.cart_add('07', g2, jsonb_build_object('menu_item_id', bun, 'size_id', bun_reg, 'addon_ids', '[]'::jsonb, 'qty', 2));
  perform public.place_session_order('07', g1, (select cart_version from table_sessions where id = s07.id));
  assert private.session_remaining(s07.id) = 250000, 'D0 bill is 250.000';

  begin perform public.request_payment('07', g1, 'share', 300); ok := false;
  exception when others then ok := sqlerrm = 'INVALID_SPLIT'; end;
  assert ok, 'D1 split must be 2..8 people';
  p1 := public.request_payment('07', g1, 'share', 3);
  p2 := public.request_payment('07', g2, 'share', 5);   -- people ignored: the first guest fixed 3
  p3 := public.request_payment('07', g3, 'share', null);
  assert (p1->>'amount')::int = 83000 and (p2->>'amount')::int = 83000 and (p3->>'amount')::int = 84000,
    format('D2 250.000 / 3 -> 83.000 / 83.000 / 84.000, got %s / %s / %s', p1->>'amount', p2->>'amount', p3->>'amount');
  assert (p1->>'reference') = 'TBL07 ' || replace((select order_no from orders where session_id = s07.id), '-', ''), 'D3 transfer note TBL07 A....';
  assert public.request_payment('07', g1, 'full', null)->>'id' = p1->>'id', 'D4 asking again returns the same pending request';

  -- H. guest_payment_qr: what the guest's phone may read (as anon, like the server calls it)
  execute 'set local role anon';
  assert (select q.amount = 83000 and q.reference = p1->>'reference' and q.bin ~ '^[0-9]{6}$'
          from public.guest_payment_qr('07', g1, (p1->>'id')::uuid) q), 'H1 a guest gets the QR data of their own pending payment';
  begin perform public.guest_payment_qr('07', g1, (p2->>'id')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'NOT_FOUND'; end;
  assert ok, 'H2 guest A cannot read guest B''s payment';
  begin perform public.guest_payment_qr('06', g1, (p1->>'id')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'NOT_FOUND'; end;
  assert ok, 'H2b the table code must match';
  execute 'reset role';
  delete from public.restaurant_settings;      -- rolled back with the whole block
  execute 'set local role anon';
  assert (select q.bin is null and q.amount = 83000 from public.guest_payment_qr('07', g1, (p1->>'id')::uuid) q),
    'H6 no bank details yet: bank columns are null (the guest pays at the counter)';
  execute 'reset role';
  insert into public.restaurant_settings (name, bank_bin, account_no, account_name)
  values ('Phở Mây Kitchen', '970436', '0000000000', 'PHO MAY KITCHEN');

  perform set_config('request.jwt.claims', json_build_object('sub', kit, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.payments set status = 'confirmed' where id = (p1->>'id')::uuid;
  get diagnostics n = row_count;
  execute 'reset role';
  assert n = 0, 'D5 kitchen cannot confirm payments';

  perform set_config('request.jwt.claims', json_build_object('sub', cas, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.payments set status = 'confirmed' where id = (p1->>'id')::uuid;
  begin update public.payments set amount = 1 where id = (p2->>'id')::uuid; ok := false;
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'D7 cashier cannot change an amount';
  begin update public.payments set status = 'pending' where id = (p1->>'id')::uuid; ok := false;
  exception when others then ok := sqlerrm = 'INVALID_PAYMENT_CHANGE'; end;
  assert ok, 'D8 a confirmed payment cannot go back to pending';
  begin update public.table_sessions set status = 'closed' where id = s07.id; ok := false;
  exception when others then ok := sqlerrm = 'UNPAID'; end;
  assert ok, 'D9 cashier cannot close an unpaid table';
  execute 'set local role anon';
  begin perform public.guest_payment_qr('07', g1, (p1->>'id')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'NOT_FOUND'; end;
  assert ok, 'H3 a confirmed payment has no QR';
  execute 'set local role authenticated';     -- back to the cashier (claims are still set)
  update public.payments set status = 'confirmed' where id in ((p2->>'id')::uuid, (p3->>'id')::uuid);
  update public.table_sessions set status = 'closed' where id = s07.id;
  begin update public.table_sessions set status = 'open' where id = s07.id; ok := false;
  exception when others then ok := sqlerrm = 'SESSION_CLOSED'; end;
  assert ok, 'D12 a closed session never reopens';
  execute 'reset role';
  assert (select confirmed_by from payments where id = (p1->>'id')::uuid) = cas, 'D6 confirm stamps confirmed_by';
  assert (select closed_by from table_sessions where id = s07.id) = cas and private.session_remaining(s07.id) = 0, 'D10 paid table closes, closed_by stamped';

  -- AC1: after closing, old cookies and the old PIN are useless
  begin perform public.cart_add('07', g1, jsonb_build_object('menu_item_id', pho, 'size_id', pho_reg, 'addon_ids', '[]'::jsonb, 'qty', 1)); ok := false;
  exception when others then ok := sqlerrm = 'SESSION_CLOSED'; end;
  assert ok, 'D11a old guest cookie cannot add after close';
  begin perform public.join_table('07', 'X', s07.pin, 'ip-z'); ok := false;
  exception when others then ok := sqlerrm = 'TABLE_CLOSED'; end;
  assert ok, 'D11b old PIN cannot join after close';

  ------------------------------------------------------------ E. owner force close (table 03 still owes money)
  r := public.request_payment('03', (select id from session_guests where session_id = s03.id limit 1), 'full', null);
  assert (r->>'guest_id')::uuid = (select id from session_guests where session_id = s03.id limit 1),
    'E0 request_payment returns the guest_id (so H5 really asks with the right guest)';
  perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin update public.table_sessions set status = 'closed' where id = s03.id; ok := false;
  exception when others then ok := sqlerrm = 'REASON_REQUIRED'; end;
  assert ok, 'E1 owner needs a reason to close an unpaid table';
  update public.table_sessions set status = 'closed', closed_reason = 'Guests left without paying' where id = s03.id;
  execute 'reset role';
  assert (select status from table_sessions where id = s03.id) = 'closed', 'E2 owner force-closes with a reason';
  assert (select status from payments where id = (r->>'id')::uuid) = 'cancelled', 'E3 pending requests are cancelled on close';
  execute 'set local role anon';
  begin perform public.guest_payment_qr('03', (r->>'guest_id')::uuid, (r->>'id')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'NOT_FOUND'; end;
  execute 'reset role';
  assert ok, 'H5 a closed session has no QR';

  ------------------------------------------------------------ F. cash at the counter
  g1 := (public.join_table('08', 'Lan', s08.pin, 'ip-d')->>'guest_id')::uuid;
  perform public.cart_add('08', g1, jsonb_build_object('menu_item_id', pho, 'size_id', pho_reg, 'addon_ids', '[]'::jsonb, 'qty', 1));
  perform public.place_session_order('08', g1, (select cart_version from table_sessions where id = s08.id));
  r := public.request_payment('08', g1, 'full', null);
  perform set_config('request.jwt.claims', json_build_object('sub', kit, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.record_cash_payment(s08.id); ok := false;
  exception when others then ok := sqlerrm = 'NOT_ALLOWED'; end;
  execute 'reset role';
  assert ok, 'F1 kitchen cannot record cash';
  perform set_config('request.jwt.claims', json_build_object('sub', cas, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  p1 := public.record_cash_payment(s08.id);
  execute 'set local role anon';               -- the request is cancelled, the session still open
  begin perform public.guest_payment_qr('08', g1, (r->>'id')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'NOT_FOUND'; end;
  assert ok, 'H4 a cancelled payment has no QR';
  execute 'set local role authenticated';
  update public.table_sessions set status = 'closed' where id = s08.id;
  execute 'reset role';
  assert (p1->>'amount')::int = 65000 and p1->>'status' = 'confirmed' and (p1->>'confirmed_by')::uuid = cas, 'F2 cash settles the rest, confirmed by the cashier';
  assert (select status from payments where id = (r->>'id')::uuid) = 'cancelled', 'F3 the VietQR request is withdrawn';

  ------------------------------------------------------------ G. read access
  execute 'set local role anon';
  assert (select count(*) from payments) = 0 and (select count(*) from restaurant_settings) = 0
     and (select count(*) from table_sessions) = 0, 'G1 anon sees no payments, settings or sessions';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', kit, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert (select count(*) from payments) = 0 and (select count(*) from restaurant_settings) = 0, 'G2 kitchen sees no payments or bank details';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', cas, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.restaurant_settings set account_name = 'HACKED';
  get diagnostics n = row_count;
  execute 'reset role';
  assert n = 0, 'G3 cashier cannot change bank details';
  perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.restaurant_settings set account_name = 'PHO MAY TEST';
  get diagnostics n = row_count;
  begin update public.restaurant_settings set account_name = 'lower case'; ok := false;
  exception when check_violation then ok := true; end;
  execute 'reset role';
  assert n = 1 and ok, 'G4 owner edits bank details; the format is checked';

  raise exception 'ALL_OK';
end $$;
