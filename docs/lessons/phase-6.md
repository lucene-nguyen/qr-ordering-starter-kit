# Phase 6 – Revenue reports · LEARNING-100

- Dates: 2026-10-29 → (in progress)
- Commits (branch `learning-100`): `4208584` (report functions + `phase6.sql`), `b752991` (O2 / O2b),
  `1a2be51` (CSV, scroll fix, 390 px)

<!-- The other sections are written at the end of the phase. -->

## What I built

## Concepts I learned

## What was hard / what broke

## Decisions I made (and why)
ADR 0004: revenue from confirmed payments, on the day the table closes.

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
- [ ] Daily revenue matches the sum of paid orders for that day.
- [x] Reports load in under 2 seconds with a few thousand orders. – About 0,3 s for every
  range × grouping with 3.080 seeded orders; the functions take 12–74 ms (see Performance).
- [x] CSV export opens correctly in Excel / Google Sheets.
  - Checked by hand on the Preview (2026-10-29): the revenue and dishes CSV for 30 days, opened in
    Excel and in Google Sheets.
  - Vietnamese text is correct, the columns split correctly, and the money columns are numbers that `SUM` adds up.
  - Automated: `src/modules/reports/csv.test.ts` (BOM, CRLF, quoting, formula injection).
  - E2E `e2e/reports.spec.ts`: the file 30 days has 30 lines, and its Revenue column adds up to the page.
- [ ] Only the owner role can view reports.

## If I did it again
