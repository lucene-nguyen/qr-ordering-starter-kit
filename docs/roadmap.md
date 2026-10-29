# Roadmap

Mirror of Jira **LEARNING-94 – QR Ordering Starter Kit (TableTap)** (Epic LEARNING-3,
https://lucenenguyen.atlassian.net/browse/LEARNING-94). If Jira and this file disagree, Jira wins –
update this file.

## Goal

Build the QR Ordering Starter Kit: a web app where restaurant customers scan a QR code at their
table to view the menu and order without installing anything. The kitchen receives orders in
realtime, and the owner handles checkout and revenue reporting. Learn-by-building project.

## Definition of Done (whole project)

- [x] End-to-end flow works: scan QR → order → kitchen sees it instantly → pay via VietQR → owner sees revenue.
  - **Production smoke test, 2026-10-29**, tables 05 and 01: QR → PIN join → order → the kitchen
    gets it → payment → close table → it shows in O2 (Revenue Today 120.000đ).
  - On prod the payment was **cash**, because prod has no bank account yet: guests are sent to the
    counter.
  - The VietQR step is verified on dev: E2E table-flow (c) has a split VietQR of 83.000đ, the cashier
    confirms it, and the guest sees "Paid".
  - On prod it can be checked once the real bank account is entered in O3 (see the last item below).
- [ ] Deployed on Vercel with near-zero running cost (domain only).
- [ ] Each phase has notes on the lessons learned (`docs/lessons/`).
- [x] Separate Supabase projects for dev (`tabletap-dev`) and prod (`tabletap`); migrations go to dev first, prod only after approval – see `supabase/README.md`.
- [ ] Before real guests: clean demo data from prod, enter the real menu and bank account, turn off public sign-ups.
  - Sign-ups: turned off on prod 2026-10-29. New staff: `docs/runbooks/add-staff.md`.
  - Still open: clean the demo data, enter the real menu, enter the bank account.

---

## Phase 1 – Table-based menu · LEARNING-95

**Scope**
- Scaffold the Next.js project and deploy it to Vercel.
- Design the Supabase schema: `categories`, `menu_items` (name, price, image, is_available), `tables`.
- Dynamic route `/t/[tableId]` that renders the menu grouped by category.
- Show the current table number in the header.
- Generate one QR code per table that points to its URL.

**Learning goals:** dynamic routing and Server Components; relational data modelling in PostgreSQL; mobile-first UI.

**Acceptance criteria**
- [x] Scanning the QR for table 1 opens the menu and shows "Table 1".
- [x] An invalid table ID shows a friendly error page.
- [x] Items marked unavailable are hidden or greyed out.
- [x] The app is live on a Vercel URL.

**Prototype screens:** 00 Join table (name step can wait until Phase 4), 00a Table not found, 01 Menu, 02 Item (view only), Staff · Settings › Tables & QR.

## Phase 2 – Cart and order submission · LEARNING-96

**Scope**
- Client-side cart: add/remove items, change quantity, per-item notes ("less spicy", "no onion").
- Schema: `orders` (table_id, status, total, created_at) and `order_items` (order_id, menu_item_id, qty, unit_price, note).
- Server Action to submit the order; recompute prices on the server, never trust client totals.
- Idempotency key per submission to prevent duplicates on double-tap or flaky network.
- Order confirmation screen.

**Learning goals:** Server Action design and input validation (Zod); idempotency and retries; snapshotting price at order time.

**Acceptance criteria**
- [x] Tapping "Submit" several times creates exactly one order.
- [x] Order totals are calculated server-side.
- [x] Notes are saved per item.
- [x] A network failure shows a retry option without losing the cart.

**Prototype screens:** 02 Item (sizes, add-ons, note, qty), 03 Cart, 03b Order failed, 04 Order status (received state).

## Phase 3 – Realtime kitchen display · LEARNING-97

**Scope**
- Kitchen display page (tablet layout) listing open orders by table and time.
- Subscribe to new and updated orders via Supabase Realtime.
- Status flow: `pending → preparing → ready → served`.
- Toggle a menu item as sold out, reflected immediately on the customer menu.
- Sound or visual alert for new orders.

**Learning goals:** realtime pub/sub (Postgres changes over WebSocket); modelling a status state machine; reconnects and missed events.

**Acceptance criteria**
- [x] A new order appears on the kitchen screen within ~2 seconds, no reload.
- [x] Status changes are visible to the customer.
- [x] Marking an item sold out hides it from the menu right away.
- [x] After a dropped connection, the screen resyncs without losing orders.

**Prototype screens:** K1 Kitchen, K1b Kitchen offline, sold-out drawer, 04 Order status (live steps).

## Phase 4 – Shared cart for multiple diners at one table · LEARNING-98

**Scope**
- Shared cart per table session, synced across devices in realtime.
- Show who added each item (optional nickname).
- "Order more" flow: add new rounds to an open table session.
- Conflict handling when two people edit the same item at the same time.

**Learning goals:** state synchronisation across clients (Realtime + DB as source of truth); concurrency and conflict resolution; session-scoped data.

**Acceptance criteria**
- [x] Two phones at the same table see the same cart within ~2 seconds.
- [x] Simultaneous quantity changes do not corrupt the cart.
- [x] Follow-up orders attach to the same table session.

**Prototype screens:** 00 Join table (name), 03 Cart ("Added by", shared banner), 04 Order status (rounds).

## Phase 5 – Anti-fake orders and payment · LEARNING-99

> Decided in [ADR 0003](decisions/0003-session-pin-and-manual-payments.md): a 4-digit session PIN
> (printed QR unchanged) instead of a rotating token in the URL, and cashier-confirmed payments.

**Scope**
- Table sessions opened by staff; ordering only allowed while a session is active.
- ~~Short-lived session token in the QR/URL~~ → a 4-digit session PIN that ends when the session closes (ADR 0003).
- Rate limiting on order submission.
- Staff auth with roles (owner, cashier, kitchen) via Supabase Auth + Row Level Security.
- Checkout: view the bill, split the bill, generate a VietQR bank-transfer code for the amount.
- Mark the session as paid and close it.

**Learning goals:** session management and token expiry; authorisation with RLS; payment integration and reconciliation basics.

**Acceptance criteria**
- [x] A photographed QR code cannot place orders once the session is closed.
- [x] Only authorised staff can open/close sessions and mark payments.
- [x] The VietQR code shows the correct amount and order reference.
- [x] Split bill totals add up to the full bill.

Evidence: `docs/lessons/phase-5.md`. Release to prod: `docs/runbooks/phase-5-release.md` (Jira stays In Review until then).

**Prototype screens:** 00b Session not open, 05 Pay, 05b Payment pending, 06 Paid, S0 Sign in, S1/S1b Tables & Open session, C2 Checkout, O3 Settings › Payment.

## Phase 6 – Revenue reports · LEARNING-100

**Scope**
- Admin dashboard: revenue by day / week / month.
- Best-selling items and revenue by category.
- Peak hours and average order value.
- Export to CSV.

**Learning goals:** SQL aggregation, views and indexes; timezone-correct grouping (Asia/Ho_Chi_Minh); data visualisation.

**Acceptance criteria**
- [x] Daily revenue matches the sum of paid orders for that day. – `supabase/tests/phase6.sql` AC1
  (+ R1–R8 for midnight in Asia/Ho_Chi_Minh, force-closed and open tables); E2E table-flow (f).
- [x] Reports load in under 2 seconds with a few thousand orders. – About 0,3 s with 3.080 seeded
  orders on dev; the functions take 12–74 ms over 90 days (`docs/lessons/phase-6.md`, Performance).
- [x] CSV export opens correctly in Excel / Google Sheets. – Revenue and dishes for 30 days opened
  by hand in both (2026-10-29): Vietnamese correct, columns split correctly, money columns are numbers
  that SUM. Automated: `csv.test.ts`, E2E `reports.spec.ts` (BOM, CRLF, totals match the page).
- [x] Only the owner role can view reports. – `phase6.sql` N1/N2 (cashier, kitchen `NOT_ALLOWED`;
  anon can't call); E2E: cashier and kitchen get O2b, cashier gets 403 on the CSV.

Evidence: `docs/lessons/phase-6.md`. Release to prod: `docs/runbooks/phase-6-release.md`.

**Decisions (ADR 0004):** revenue = confirmed payments of closed tables, on their closing day
(Asia/Ho_Chi_Minh), including money confirmed before a force-close; what those tables still owed is
shown apart as "Unpaid (closed by owner)". The KPIs are "Orders" (all closed tables) and
"Avg. per table" (revenue ÷ closed tables). The AC1 "paid orders" are the orders of fully paid tables.

**Prototype screens:** O2 Reports, O2b Reports · cashier (no access). O1 Menu "Sold today" moved
to Later.

## Later (not scheduled)

- O1 Menu management with a "Sold today" column (the O1 screen itself was never built).
- "Void payment" for the owner, with a reason, for a payment confirmed by mistake (ADR 0004).

- Bank webhook to confirm VietQR transfers automatically (Phase 5 uses cashier confirmation).
- C2 "Show VietQR" for the remaining amount, so a guest can transfer at the counter. Needs a
  staff function that creates the payment row (amount and transfer note from the database);
  Phase 5 has guests scan on their own phone (05) or pay cash.
- Restaurant name from `restaurant_settings` on guest screens (Join, menu) and the sidebar. Guests
  can't read that table, so it needs a small public function that returns only the name; the
  name is still written in the code.
