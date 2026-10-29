# Phase 5 – Anti-fake orders and payment · LEARNING-99

- Dates: 2026-10-28 → released to prod 2026-10-29 (PR #1, merge `cfd5da3`). Released via MCP, prod
  history by name (`docs/runbooks/phase-5-release.md`).
- Commits (branch `learning-99`): on `main` `55d580c` (types from dev), `67cf84f` (dev/prod split docs,
  ADR 0003, E2E); then `37f31f2` (SQL), `07b39e4` + `613133c` (VietQR + split), `d57da37` (console + S1),
  `54ced65` (00b + PIN join), `01a0029` (Preview/prod guard), `042d8b2` (05/05b/06 + C2),
  `5e954bd` (cash guard, no placeholder account), `d48a139` (O3 settings)

## What I built
- Staff open and close table sessions (S1/S1b). Each session gets a 4-digit PIN, and guests need it
  to join (00, 00b). Wrong PINs are rate-limited per IP + table and per table. Rounds are limited to
  5 per 10 minutes. – `supabase/migrations/20261028400000_phase5_sessions_payments.sql`,
  `src/modules/table-session/`.
- Payments: a guest pays the full bill or an equal share by VietQR (05 → 05b → 06). The cashier
  confirms the transfer on C2, or records cash; the table can only be closed once settled (the owner
  may force-close with a reason). – `src/modules/payments/`, `src/app/t/[tableId]/pay/`,
  `src/app/staff/(console)/checkout/`.
- VietQR payload (EMVCo TLV + CRC-16) and the split rule as pure, unit-tested functions –
  `src/modules/payments/vietqr.ts`, `split.ts`.
- O3 Settings › Payment: bank from a list of BINs, account, holder name, with a scannable 10.000đ
  preview. No bank details → guests are told to pay at the counter. – `src/app/staff/(console)/settings/`.
- Two Supabase projects (dev / prod), a DB badge in the console and a guard that blocks writes when
  a Preview points at prod; Playwright E2E against dev only – `src/lib/db-target.ts`, `e2e/`.

## Concepts I learned
**A session PIN instead of a rotating QR token.** The printed QR never changes. What makes a photo
of it useless later is the session. Staff open a session, which gets a fresh PIN that they tell the
guests. Closing the session ends the PIN and every guest cookie tied to it. Wrong guesses are
counted in the database (`join_attempts`), so 10.000 combinations are plenty (ADR 0003).

**Business rules on the row itself (BEFORE triggers).** RLS decides *which rows* a staff member may
touch, and column grants decide *which columns*. A trigger decides *which changes make sense*:
- a session closes only when paid, unless the owner gives a reason;
- a payment goes only pending → confirmed or cancelled;
- who and when are stamped by the database, not sent by the app.

These rules hold even for someone calling the REST API directly with a staff token.

**The database is the source of truth for money.** `request_payment` computes every amount and the
transfer note, and the QR shows `payments.amount` / `payments.reference` exactly as stored. The
TypeScript `splitEvenly` is a tested copy of the rule, used only for the preview on 05.

**Equal split, one payer at a time.** Each share is what is still open divided by the people who have
not paid, rounded down to 1.000đ; the last payer takes the rest. 250.000đ / 3 → 83.000 + 83.000 +
84.000. The total always adds up, even when someone pays cash in between.

**Least privilege for guests.** Guests have no RLS access at all. For the QR, the server calls one
`security definer` function (`guest_payment_qr`) with the publishable key. It answers only for this
guest's own pending payment in an open session; anything else is `NOT_FOUND`. The secret key is
not needed to show bank details.

**Realtime as a doorbell, again.** The cashier's confirm broadcasts `payment` on `session:<id>`. The
guest's 05b re-reads and becomes 06. Staff screens use `postgres_changes` with RLS (`setAuth` first).

## What was hard / what broke
- **A Preview on the prod database.** Vercel Preview had the prod Supabase variables mixed in.
  `/staff/tables` failed (`PGRST200`: prod had no `payments` yet), but `/t/05` showed "table isn't
  open". The cause was that `getOpenSession` swallowed the query error and returned "no session".
  Fix: queries now throw instead of guessing, there is a DB badge on non-production deployments,
  and writes are blocked when a Preview points at prod.
- **Paying twice.** "Paid in cash" withdraws any VietQR request that is still awaiting. If the
  transfer had already arrived, the table would pay twice. Fix: the button names the amount, and an
  in-page dialog asks the cashier to check the bank app first.
- **A placeholder bank account in a migration** would have reached prod and sent real money to
  `0000000000`. Fix: no settings row until the owner enters one; the demo account lives in `seed.sql`.
- **E2E timing.** `signIn` returned before the auth cookie was set, so the next `goto` cancelled the
  sign-in; a closed table's panel was checked with `isVisible()` (no wait). Both now wait explicitly.

## Decisions I made (and why)
- ADR 0003: session PIN + lockout instead of tokens in the URL; cashier-confirmed VietQR (bank
  webhook later); equal split rounded to 1.000đ; rate limits inside the database.
- Owner can force-close an unpaid table but must give a reason; cashier cannot.
- No idle expiry any more: staff own the session lifecycle; S1 only flags tables idle for 3 h+.
- Dev first, prod by hand after review; Phase 5 code stays on `learning-99` until prod is migrated.
- Backlog: C2 "Show VietQR" (needs a staff function that creates the payment row); a public way for
  guests to read the restaurant name (it is still written in the code).

## Acceptance criteria check
- [x] A photographed QR code cannot place orders once the session is closed – `phase5.sql` D11a/D11b
  (old cookie and old PIN refused), E2E (a) guest moves to 00b and loses the cookie.
- [x] Only authorised staff can open/close sessions and mark payments – `phase5.sql` A1, D5, D9, F1,
  G3, G5; E2E kitchen/cashier refused on Tables and Settings.
- [x] The VietQR code shows the correct amount and order reference – `vietqr.test.ts` (payload + CRC),
  E2E (c) QR for 83.000đ with `TBL09 A…`, O3 preview scanned with a real banking app (after release).
- [x] Split bill totals add up to the full bill – `split.test.ts`, `phase5.sql` D2 (83.000 / 83.000 / 84.000).

## If I did it again
