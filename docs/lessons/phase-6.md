# Phase 6 – Revenue reports · LEARNING-100

- Dates: 2026-10-29 → 2026-10-29 (released to prod: pending, see `docs/runbooks/phase-6-release.md`)
- Commits (branch `learning-100`, PR #3):
  - `4208584`: report functions and `phase6.sql`;
  - `b752991`: O2 / O2b;
  - `1a2be51`: CSV, scroll fix, 390 px;
  - `65c1ea1`: nav on phones, dev seed;
  - `7b2c131`: measurements;
  - then the docs and runbook.
- Before Phase 6, on the same branch (PR #2, released 2026-10-29):
  - `7aa9824`: no VietQR without a bank account;
  - `bf2cf9e`: guest home page;
  - `b4be3af`: LF line endings.

## What I built
- **Three owner-only report functions** in SQL: `report_revenue` (day / week / month),
  `report_items` and `report_hours`. Revenue follows ADR 0004. –
  `supabase/migrations/20261029150739_phase6_reports.sql`, tested by `supabase/tests/phase6.sql`.
- **O2 Reports:**
  - KPIs: Revenue, Orders, Avg. per table and Today so far, each compared with the previous period
    of the same length;
  - revenue bars in CSS, best sellers, revenue by category and peak hours;
  - an "Unpaid (closed by owner)" banner.
  - Other roles get O2b. – `src/app/staff/(console)/reports/`, `src/modules/reports/`.
- **CSV export** of revenue per day/week/month or per dish: UTF-8 BOM, CRLF, quoting and a guard
  against formula injection. – `src/modules/reports/csv.ts`, `reports/export/route.ts`.
- **Dev history seed** (~3.000 orders over 90 days on the inactive table R1) with an exact cleanup.
  Both refuse to run outside dev. – `supabase/dev/`.
- **Fixes before the phase:**
  - no VietQR request without a bank account (`NO_BANK_ACCOUNT`, `guest_bill`);
  - a real home page at `/`;
  - the console nav wraps on phones.

## Concepts I learned
**Revenue is a definition, not a sum.** "Sum of orders" and "sum of payments" give different numbers
as soon as a table leaves without paying or a payment is confirmed by mistake. Here, revenue is the
money confirmed for tables that closed, on the day they closed (ADR 0004). What force-closed tables
still owed is shown next to it, never mixed in. Dishes and hours count what was served.

**Grouping by a local day.** `timestamptz` is a moment in time; "which day" depends on the time zone.
`closed_at at time zone 'Asia/Ho_Chi_Minh'` turns the moment into Vietnamese wall-clock time, and
`date_trunc('day' | 'week' | 'month', …)` groups it. Weeks start on Monday. A range of local dates
becomes a UTC range with `(date::timestamp at time zone 'Asia/Ho_Chi_Minh')`, so the filter can still
use an index on `closed_at`. `phase6.sql` R3 checks the edge: 23:30 stays on the day, 00:30 moves to
the next one.

**Filling gaps with `generate_series`.** A `group by` only returns days that have rows. Left-joining
the data to `generate_series(from, to, '1 day')` gives every day, with 0 where nothing closed, so the
bar chart has no holes and the CSV has one line per day.

**Security invoker vs definer, and why not a view.**
- A `security invoker` function runs with the caller's rights, so RLS still applies.
- The owner check sits at the top of each function, because a cashier may legally read `payments`
  for checkout.
- A view can't say "owner only" when the underlying tables allow the cashier.
- `guest_payment_qr` (Phase 5) is the opposite case: a `security definer` function, used because
  guests have no RLS access at all.

**Reading a query plan.** `EXPLAIN (ANALYZE, BUFFERS)` shows what Postgres actually did:
- **Seq scan vs index:** a seq scan is the right choice when most of the table matches.
- **Loop counts:** how many times each subquery ran.
- **`shared hit`:** blocks read from memory, not disk.
- **InitPlan:** `(select private.staff_role())` inside an RLS policy shows up as an InitPlan, so the
  role is looked up once per query, not once per row.

**CSV is a tiny format with sharp edges.**
- **BOM:** without it, Excel reads UTF-8 as Windows-1252 and "Phở" breaks.
- **CRLF** line ends and **RFC 4180** quoting.
- **Formula injection:** a dish named `=HYPERLINK(…)` would become a live formula, so text starting
  with `= + - @` (or a tab or CR) gets a leading `'`.

**Soft navigation keeps the page.** Links that only change the query string still scroll to the top by
default. `scroll={false}` keeps the reader's place and `replace` avoids one history entry per click.
Without a `loading.tsx`, Next keeps the old content on screen until the new one is ready, so nothing
flashes.

## What was hard / what broke
- **A VietQR payment with no bank account (Phase 5 smoke test on prod).**
  - With no `restaurant_settings` row, "Request bill" still created a pending VietQR payment, and
    the cashier confirmed 15.000đ that never arrived.
  - Fix: the database refuses (`NO_BANK_ACCOUNT`), `guest_bill` tells screen 05 to send the guest
    to the counter, and no payment row is created.
  - Lesson: a missing setting must stop the flow in the database, not only change the screen.
- **Scroll jumped to the top on Day / Week / Month** (seen on the Preview). The cause was the
  default scroll of Next's `<Link>`. The E2E proved it: the new test fails without `scroll={false}`.
- **Hidden nav items on phones.** The console nav scrolled sideways, so Reports and Settings were
  off-screen at 390 px. Now it wraps.
- **Line endings.** Windows checkouts turned files into CRLF, so a small edit showed the whole file
  as changed. `.gitattributes` now pins LF.
- **The Preview can't be measured by Playwright** because of Deployment Protection, and that is
  intended. The load time was measured on a local production build against the same dev database.

## Decisions I made (and why)
- **ADR 0004: revenue = confirmed payments of closed tables, on the day the table closes.** This
  includes money confirmed before a force-close; the shortfall is shown apart as "Unpaid".
  Dishes, categories and hours cover every closed table.
- **"Orders" and "Avg. per table" rather than "Paid orders" and "Avg. order value".** A table pays as
  a whole, and the order count includes force-closed tables.
- **Functions, not views**, for the owner check (see Concepts).
- **One time zone constant** in SQL and the app (`REPORT_TIMEZONE`). The database can't read
  `APP_TIMEZONE`.
- **No chart library.** The bars are plain CSS, with one list item per bar for screen readers.
- **Previous period:** a second `report_revenue` call for the range of the same length right before.
- **Backlog:** O1 "Sold today" (O1 itself was never built); "Void payment" for the owner.

## Performance (dev, seeded history)
**Data.** `supabase/dev/seed-reports.sql` on dev (2026-10-29), all on the inactive table R1:
- 1.257 sessions, 64 of them force-closed;
- 3.080 orders, 100 of them cancelled;
- 31 Jul → 28 Oct, nothing on today.

Together with the E2E sessions, a 90-day range covers 1.314 closed sessions.

**Checked by hand on the Preview with this data:**
- weekend bars are higher;
- the Unpaid banner shows;
- peak hours run from 10h to 23h;
- the KPIs compare with the previous period, with the trend arrow;
- "Today so far" only has real activity;
- the Week and Month labels are right.

**Database time** (Postgres execution time as the owner, without the network):

| Query | Cuong (MCP) | Claude (`EXPLAIN ANALYZE`) |
|---|---|---|
| `report_revenue` 90 days, day | 32 ms | 64 ms |
| `report_revenue` 90 days, month | 21 ms | – |
| `report_revenue` 30 days, day | 9 ms | – |
| `report_items` 90 days | 43 ms | 74 ms |
| `report_hours` 90 days | 11 ms | 12 ms |

Every block came from the buffer cache (`shared hit`, no disk reads). The differences between the
two columns are just separate runs on a shared Free-plan instance.

**What the plans show (90 days):**
- **`table_sessions`: seq scan, and that is right.** The range matches 1.314 of the table's rows,
  almost all of it (117 pages). Reading the whole table is cheaper than the partial index on
  `closed_at`. The index starts to help when 7 or 30 days are a small part of a long history.
- **Every other step uses an index:** `payments_session_id_idx`, `orders_session_id_idx`,
  `order_items_order_id_idx`, and the primary keys of `menu_items` and `categories`.
- **`report_revenue` runs three small subqueries per session** (confirmed payments, bill, order
  count): 1.314 loops each, about 0,01–0,03 ms per loop. Fine at this size. With far more data,
  pre-aggregating payments and orders per session in one `group by` would replace the loops.
- **RLS costs almost nothing here.** Each policy calls `(select private.staff_role())`, and that
  runs once per query as an InitPlan, not once per row. That is why the policies wrap the call in
  `select`.
- **The planner guessed 20 rows instead of 1.314** for `table_sessions`: the statistics were older
  than the seed. Autovacuum's ANALYZE fixes that by itself. The plan was right anyway.

**Page load** (Playwright, `e2e/reports-perf.spec.ts`, run with `E2E_PERF=1`). Time from `goto` until
the chart is visible. Each case was loaded 4 times; the first (cold) load is dropped and the median of
the other 3 is shown.

| Range | Day | Week | Month |
|---|---|---|---|
| 7 days | 298 ms | 297 ms | 302 ms |
| 30 days | 314 ms | 304 ms | 316 ms |

- This is a local production build (`next start`) talking to dev Supabase in Singapore, not the
  Vercel Preview in sin1. The Preview is behind Vercel Deployment Protection, and Playwright does not
  get past it (by choice: no bypass token).
- The Preview's runtime logs only record what the code prints, so they had no server timings.
- On the Preview, the Vercel function sits in the same region as the database, so its database
  round trips should be shorter than from a laptop.

**Result:** about 0,3 s against the 2 s target, with a few thousand orders. No new index needed.

## Acceptance criteria check
- [x] Daily revenue matches the sum of paid orders for that day.
  - `phase6.sql` AC1, checked on a day of fully paid tables.
  - R1–R3 also check a cancelled order, a withdrawn request, and midnight in Asia/Ho_Chi_Minh.
  - E2E table-flow (f): an open table adds nothing; once paid and closed, it adds 15.000đ to Revenue
    and to Today so far.
- [x] Reports load in under 2 seconds with a few thousand orders. – About 0,3 s for every
  range × grouping with 3.080 seeded orders; the functions take 12–74 ms (see Performance).
- [x] CSV export opens correctly in Excel / Google Sheets.
  - Checked by hand on the Preview (2026-10-29): the revenue and dishes CSV for 30 days, opened in
    Excel and in Google Sheets.
  - Vietnamese text is correct, the columns split correctly, and the money columns are numbers that `SUM` adds up.
  - Automated: `src/modules/reports/csv.test.ts` (BOM, CRLF, quoting, formula injection).
  - E2E `e2e/reports.spec.ts`: the file 30 days has 30 lines, and its Revenue column adds up to the page.
- [x] Only the owner role can view reports.
  - `phase6.sql` N1: cashier and kitchen get `NOT_ALLOWED` from all three functions.
  - N2: anon can't call them.
  - E2E: cashier and kitchen see O2b; the cashier gets 403 on the CSV.

## If I did it again
