# Phase 4 – Shared cart for one table · LEARNING-98

- Dates: 2026-10-28 → (in progress)
- Commits: `53196bf` (SQL: sessions, cart, session orders), `e723ee3` (join + guest cookie), then the shared cart UI

## What I built
- `table_sessions`, `session_guests`, `cart_items` and the functions `join_table`, `cart_add`, `cart_change`,
  `place_session_order`; pricing shared through `private.price_line` – `supabase/migrations/20261028300000_phase4_shared_cart.sql`.
- 00 Join with an httpOnly `tt_guest` cookie – `src/modules/table-session/`.
- Shared cart (03) with "Added by", the "ordering together" banner and optimistic +/−, synced through a
  broadcast on `session:<id>` – `src/modules/orders/components/cart-view.tsx`, `src/modules/orders/actions.ts`.

## Concepts I learned
**Database as the source of truth, Realtime as a doorbell.** The cart lives in Postgres. After every
change the Server Action broadcasts `cart` on `session:<id>`. Each phone then asks the server for
the cart again (debounced 300 ms). No phone ever trusts another phone's copy.

**Atomic deltas vs. optimistic concurrency vs. last-write-wins.** Two people press + on the same line:
- *Last-write-wins* ("set qty = 3"): both phones read 2 and both write 3, so one press is lost.
- *Optimistic concurrency* (`version` column, "update … where version = $seen"): the second write
  is rejected and that phone must re-read and retry ("Someone changed this item"). Correct, but the
  guest sees a conflict for something that was never really a conflict.
- *Atomic delta* ("set qty = qty + 1"): Postgres applies both, 2 → 4. Increments commute, so there is
  nothing to resolve. That is why `cart_items` has no `version` column.

Conflicts that deltas cannot merge are handled with a version check where it matters: the whole cart
has a `cart_version`, and `place_session_order` refuses a stale one (`CART_CHANGED`) unless the cart
is empty because someone else just sent it ("<name> just sent this round").

**Merge key with `nulls not distinct`.** A unique index on (session, dish, size, add-ons, note, guest)
makes "same guest, same choice" one row (`on conflict … qty = qty + excluded.qty`). Postgres 15+ can
treat NULL size/note as equal (`nulls not distinct`), so "no note" twice still merges. Notes are
normalised first (trim, empty → null), and add-on ids are sorted.

**Optimistic UI that falls back to the truth.** `useOptimistic` shows +1 at once. When the action
ends, React drops the optimistic value and shows the server's cart: fresh via `revalidatePath` if
the action worked, the old one if it failed. Tested: a + on an expired session showed 4, went back
to 3 and explained why.

## What was hard / what broke
- **How fast is "realtime" here?** Measured from phone A tapping *Add to cart* until phone B shows the
  line, on a local production build (`npm start`) against the Supabase project in ap-southeast-1:
  **1.87 s, 1.36 s, 1.87 s** (target < 2 s). The time adds up from: A's Server Action (RPC +
  revalidate), the broadcast over HTTP, the 300 ms debounce, then B's `router.refresh()` round trip.
  It passes, but with little margin. If it grows, the first things to try are broadcasting *before*
  revalidating and a shorter debounce.
- Putting cart helpers in `queries.ts` would have pulled `server-only` code into Client Components.
  Shared helpers now live in `src/modules/orders/types.ts`.

## Decisions I made (and why)
- Sessions open on first join and expire after 4 h idle (temporary until staff open/close tables in
  Phase 5). To close a table by hand while testing:
  ```sql
  update table_sessions set status = 'closed', closed_at = now()
  where status = 'open' and table_id = (select id from tables where code = '05');
  ```
- Guests stay anonymous (ADR 0002): no Supabase auth for guests, no RLS access; the cookie is the
  credential and the server reads with the secret key.
- Anyone at the table may press Place order; one cart version can only become one order.

## Acceptance criteria check
- [x] Two phones at the same table see the same cart within ~2 seconds – 1.36–1.87 s measured (above).
- [x] Simultaneous quantity changes do not corrupt the cart – E2E: both phones + at once, 1 → 3 on both;
  load test: 40 parallel +1 → +40, ±15 → unchanged, cap 50.
- [x] Follow-up orders attach to the same table session – E2E: round 2 on the same session; SQL tests.

## If I did it again
<!-- Your answers. Questions to think about:
- Would anonymous Supabase sign-in for guests (RLS + postgres_changes) have been simpler or harder than cookie + broadcast?
- Is 1.4–1.9 s "realtime enough" for a shared cart? What would you change first to make it faster?
- Which conflicts in a restaurant really need a human decision, and which can always be merged?
- Was it right to put the cart rules in SQL functions instead of TypeScript actions? What got easier or harder to test?
-->
