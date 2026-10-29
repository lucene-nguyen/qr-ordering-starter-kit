# ADR 0004 – Revenue from confirmed payments, on the day the table closes

- Status: Accepted
- Date: 2026-10-29
- Phase: LEARNING-100 (Phase 6)

## Context

Phase 6 needs revenue by day, week and month. The acceptance criterion says "daily revenue matches
the sum of paid orders for that day". In this app, though, guests don't pay per order: they pay per
table session (full bill, equal shares or cash at the counter), and the owner can close a table that
still owes money ("Guests left without paying").

So there are two candidate sources:
- **Orders** (`orders.total`): counts food that was served, including bills nobody paid.
- **Payments** (`payments` with status `confirmed`): counts money the cashier saw arrive.

The Phase 5 smoke test made the difference concrete. A VietQR payment of 15.000đ was confirmed on
prod although no bank account existed, so the money never arrived. Neither source would have hidden
that mistake. The fix belongs where the mistake happens (LEARNING-100: no VietQR without a bank
account), and a confirmed payment that turns out wrong needs a "void" action later.

## Decision

- **Revenue = confirmed payments of closed sessions.** A session counts on the day it closed
  (`closed_at` in Asia/Ho_Chi_Minh), not on the day of each order or payment.
  - A table open across midnight counts on the day it closes: ordered at 23:50, closed at 00:30 →
    the new day.
  - Open tables are not in any report yet. "Today so far" grows each time a table closes, as in
    the prototype.
- **Force-closed tables.** Money confirmed before the owner closed the table *is* revenue. What the
  table still owed is shown apart as **"Unpaid (closed by owner)"** and is never added to revenue.
- **Dishes, categories and peak hours** come from `order_items` / `orders` of every closed session,
  without cancelled orders. Force-closed tables are included, because those dishes were served.
  This means dish revenue can be more than payment revenue; the difference is the unpaid amount.
- **KPIs:** "Orders" counts the orders of all closed sessions in the period, including force-closed
  ones, so it is not called "Paid orders". "Avg. per table" = revenue ÷ closed sessions (0 when no
  table closed), not per order: a table pays as a whole, not per order.
- **Comparison:** the period of the same length right before (yesterday, previous 7 days, previous 30
  days).
- **Time zone:** `Asia/Ho_Chi_Minh` is written in the SQL functions, because the database can't read
  the app's `APP_TIMEZONE`. The page uses the same constant (`REPORT_TIMEZONE`) to decide "today".
- **Access:** `report_revenue`, `report_items` and `report_hours` are `security invoker`, use
  `search_path = ''` and refuse anyone but the owner (`NOT_ALLOWED`). A cashier can read payments
  through RLS for checkout, so the role check has to be inside the functions.

## Consequences

- The AC holds for every day of fully paid tables: their confirmed payments equal their non-cancelled
  orders, because `request_payment` and "Paid in cash" only ever take what is still owed.
  `supabase/tests/phase6.sql` (AC1) checks this.
- A payment confirmed by mistake inflates revenue until it can be voided. Backlog: "Void payment"
  for the owner, with a reason.
- Changing the restaurant's time zone means changing the SQL functions and `REPORT_TIMEZONE`
  together.
- A week or month bucket can start before the chosen range (the week of Monday 9 Mar for a range from
  10 Mar). Its label says so ("Week of 9 Mar", "Mar 2020"); its totals only include tables closed
  inside the range.
