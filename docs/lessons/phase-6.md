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
<!-- Filled in after running supabase/dev/seed-reports.sql on dev: page load times for 7/30 days ×
Day/Week/Month, and EXPLAIN ANALYZE of report_revenue / report_items / report_hours for 90 days. -->

## Acceptance criteria check
- [ ] Daily revenue matches the sum of paid orders for that day.
- [ ] Reports load in under 2 seconds with a few thousand orders.
- [x] CSV export opens correctly in Excel / Google Sheets.
  - Checked by hand on the Preview (2026-10-29): the revenue and dishes CSV for 30 days, opened in
    Excel and in Google Sheets.
  - Vietnamese text is correct, the columns split correctly, and the money columns are numbers that `SUM` adds up.
  - Automated: `src/modules/reports/csv.test.ts` (BOM, CRLF, quoting, formula injection).
  - E2E `e2e/reports.spec.ts`: the file 30 days has 30 lines, and its Revenue column adds up to the page.
- [ ] Only the owner role can view reports.

## If I did it again
