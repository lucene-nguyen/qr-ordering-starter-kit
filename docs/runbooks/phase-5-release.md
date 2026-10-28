# Runbook – release Phase 5 to production · LEARNING-99

Status: **draft, not executed.** The owner (Cuong) runs every prod step by hand; no agent touches prod.

What goes out:
- DB (prod `sxwcsxyalzblvkhtlola`): `20261028400000_phase5_sessions_payments.sql`,
  `20261028401000_guest_payment_qr.sql`, `20261028402000_owner_adds_settings.sql`.
- App: merge `learning-99` → `main`. Vercel then builds Production.

Today prod runs the Phase 4 code (`main` = `67cf84f`, deployment `dpl_suqE3CkEd49AL981nmMYeXhNHuLV`)
on the Phase 4 schema.

## a. Compatibility: new schema + old (Phase 4) code

This is the state between "migrations applied" and "new deployment Ready", about 1–2 minutes. It is
also the state after a Vercel-only rollback.

| Phase 4 call (main) | After the migrations | Effect |
|---|---|---|
| `join_table(p_table_code, p_name)` – every new guest | **dropped**; only `join_table(code, name, pin, ip)` exists → PostgREST "function not found" | **Breaks.** No new guest can join any table ("We couldn't join this table"). |
| Phase 4 join opening a session on first scan | no longer exists (staff open sessions) | Breaks with the row above. |
| `cart_add`, `cart_change` | unchanged | Works for guests who were already joined. |
| `place_session_order` | same signature, now also `RATE_LIMITED` after 5 rounds / 10 min | Works. A 6th round shows the generic error (Phase 4 has no message for it). |
| `private.guest_session` (inside the cart functions) | no 4 h idle expiry any more | Works. The Phase 4 app still hides sessions idle > 4 h itself. |
| Reading `table_sessions` / `session_guests` / `cart_items` / `orders` with the secret key | new columns only (`pin` gets a random default on existing rows) | Works. |
| Kitchen board, advance status, sold-out toggle, staff sign-in, QR page | untouched | Works. |
| Closing a session | Phase 4 only closes inside `join_table` (idle > 4 h) | Not reachable: that join is gone. |

The other direction, new code on the old schema, is worse: S1 fails (`PGRST200`, no `payments`
table), joins fail (no 4-argument `join_table`), and every pay page fails. That is exactly what the
mis-configured Preview showed. **So the migrations go first, then the merge, never the reverse.**

Guests who are mid-meal keep working through the gap. Only *new* joins fail until the new code is live.

## b. Order of steps (keeps the gap to the Vercel build time)

**Before (any time earlier that day)**
1. Open the PR `learning-99` → `main` and read the diff. Do not merge yet. Make sure the Preview of
   the branch is green: E2E on dev passes (`npm run test:e2e`) and `npm run build` passes.
2. Read the three migration files once more. This is the approval step.
3. Check on Vercel that Production has the prod Supabase variables (3 names, Production only). Done
   2026-10-28.

**Release (at a quiet hour, e.g. 15:00–16:00 or after closing)**
4. Run the "before" checks (section e). Write down the open sessions.
5. **End open sessions on prod.** Phase 4 has no close button, so do it in SQL. Ask the guests to pay
   at the counter first. Run this *before* the migration, while no trigger exists yet:
   ```sql
   -- shows what will be closed; today: Table 05 with order A-0028
   select t.code, s.id, s.opened_at, string_agg(o.order_no, ', ') as orders
   from table_sessions s join tables t on t.id = s.table_id left join orders o on o.session_id = s.id
   where s.status = 'open' group by t.code, s.id, s.opened_at;

   update table_sessions set status = 'closed', closed_at = now() where status = 'open';
   ```
   Not strictly required: open sessions survive the migration. But they would come out of it with no
   staff opener and a PIN nobody was told, and unpaid bills from before payments existed. Starting
   clean is simpler.
6. **Apply the three migrations, in file order, each in one transaction.** If a statement fails, the
   whole file is rolled back.
   - SQL Editor: paste the file between `begin;` and `commit;` and run it.
   - Then record it, because the SQL Editor does not write the migration history:
     ```sql
     insert into supabase_migrations.schema_migrations (version, name)
     values ('20261028400000', 'phase5_sessions_payments');   -- likewise 401000 guest_payment_qr, 402000 owner_adds_settings
     ```
   - The Supabase MCP `apply_migration` with the same names records the history by itself.
7. Run the "after" checks (section e) and the Security Advisor. Stop here if anything is off (section d).
8. **Merge the PR into `main` right away.** Wait for the Vercel Production deployment to be **Ready**,
   about 1–2 minutes. This is the only window where new guests cannot join.
9. Smoke test (section c).

## c. Checks after the release

1. Vercel: the Production deployment is Ready, and the commit is the merge of `learning-99`.
   `GET /t/05` returns 200 and shows **00b "This table isn't open yet"**.
2. Staff console on production: the sidebar has **no** DB badge (the badge only shows outside
   production) and no red warning.
3. **O3 (owner, by hand):**
   - Enter the real bank, account number and holder name. Save.
   - Scan the **10.000đ preview QR** with a real banking app. The app must show the right bank and
     holder name. Do not complete the transfer.
   - Until this is saved, guests see "Pay at the counter". That is expected: prod has no settings row.
4. S1: open one table. The PIN shows after "Show".
5. Guest phone: scan that table, join with the PIN, order 1 item. The kitchen display shows the order.
6. Request bill → 05 shows the QR, the amount and the transfer note `TBL<table> <order>`.
7. C2: press "Paid in cash · …". If a VietQR request is awaiting, the confirmation dialog appears.
   Then the table shows Settled. Close the table. The guest phone moves to 00b.
8. Vercel runtime errors for the last 15 minutes: none.
9. Then: Jira LEARNING-99 → Done; the lesson's "released" date.

## d. Rollback

**Preferred: fix forward.** Most problems after step 8 are small (a message, a layout) and a quick
commit on `main` fixes them faster than a rollback.

**The migration fails (step 6).** The transaction rolls back, so prod is unchanged and still runs
Phase 4 fine. Do not merge. Fix the file on a branch, apply it on dev, then repeat this runbook.

**Phase 5 does not work after step 8 and cannot be fixed quickly.** A Vercel rollback **alone is
not enough**: the old code needs `join_table(text, text)`, which the migration dropped (section a).
Do both steps:
1. Vercel → Deployments → the previous Production deployment (`67cf84f`, `dpl_suqE3CkEd49AL981nmMYeXhNHuLV`)
   → **Instant Rollback**. Then on git: `git revert -m 1 <merge commit>` and push `main`, so the next
   push does not bring Phase 5 back.
2. Make the DB work for the Phase 4 code again. This keeps all data (payments, settings, PINs), only
   adds back the old join and removes the rules that the old join would trip over:
   ```sql
   begin;
   -- Phase 4 join closes idle sessions itself; the Phase 5 rule would refuse that ("UNPAID").
   drop trigger table_sessions_rules on public.table_sessions;
   drop trigger payments_rules on public.payments;
   -- Paste here the whole `create function public.join_table(p_table_code text, p_name text) … $$;`
   -- statement from 20261028300000_phase4_shared_cart.sql (lines 160–192).
   revoke execute on function public.join_table(text, text) from public, anon, authenticated;
   grant execute on function public.join_table(text, text) to service_role;
   commit;
   ```
   Then check: a guest can join a table on production and order.
3. Before releasing Phase 5 again: the three migrations are already in the history, so the fix needs
   a **new** migration. It must drop `join_table(text, text)` and recreate the two triggers (copy them
   from `20261028400000`). Test it on dev first.

## e. Migration history checks (SQL Editor on prod, read-only)

**Before (step 4)**
```sql
-- Prod was applied through the MCP, so versions are times of applying; the names matter.
select version, name from supabase_migrations.schema_migrations order by version;
-- expect the Phase 1–4 names (phase1_menu … cart_add_qty_check) and nothing from Phase 5

select to_regclass('public.payments') as payments, to_regclass('public.restaurant_settings') as settings,
       to_regclass('public.join_attempts') as join_attempts;          -- expect all null

select pg_get_function_identity_arguments(p.oid) as join_table_args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'join_table';             -- expect: p_table_code text, p_name text
```

**After (step 7)**
```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
-- expect 20261028402000 owner_adds_settings, 20261028401000 guest_payment_qr, 20261028400000 phase5_sessions_payments

select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('join_table', 'request_payment', 'cancel_payment', 'record_cash_payment', 'guest_payment_qr')
order by 1;  -- expect 5 rows; join_table only (p_table_code text, p_name text, p_pin text, p_ip text)

select tgname from pg_trigger where tgname in ('table_sessions_rules', 'payments_rules');  -- expect 2 rows
select count(*) as settings_rows from public.restaurant_settings;                         -- expect 0 (no placeholder)
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
-- expect exactly menu_items, orders, payments, table_sessions
```

Then run the dev/prod schema fingerprint (`supabase/README.md`, "Comparing dev and prod"). Dev ran an
older version of `20261028400000`, the one that still inserted a placeholder settings row. The schema
is the same; only the data differs (dev has the demo row from `seed.sql`).
