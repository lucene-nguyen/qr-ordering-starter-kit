# ADR 0002 – Bring staff sign-in forward to Phase 3

- Status: Accepted
- Date: 2026-10-28

## Context

Phase 3 adds the kitchen display. It must receive new orders in realtime and change their
status. Supabase Realtime `postgres_changes` only delivers a row to a subscriber who may `select`
it under RLS. The kitchen also writes data (status, sold-out flag). The roadmap places staff
auth in Phase 5, so in Phase 3 nobody could be identified as staff.

Options considered:

1. **Staff sign-in now** – Supabase Auth, `staff_profiles` with roles, RLS for staff.
2. **Temporary `anon` read on `orders`** – fastest, but anyone with the URL sees every order of
   the restaurant. This is the "loosen RLS to make it work" the project forbids.
3. **Server-side Broadcast only** – the server announces changes on a channel. Without auth the
   channel is public too, so it only moves the leak, and the kitchen's writes are still anonymous.

## Decision

Option 1, kept small:

- `staff_profiles (user_id, display_name, role)` with roles `owner`, `cashier`, `kitchen`, and
  `private.staff_role()` (security definer, in a schema the API does not expose) for policies. All three roles exist; Phase 3 uses `kitchen`.
  The QR page becomes owner-only.
- Accounts are created in the Supabase Dashboard (Auto Confirm). The app has only a sign-in page
  (S0). `src/proxy.ts` sends signed-out users on `/staff/*` to it, and pages and actions check the role.
- RLS gives staff `select` on `orders`/`order_items`. `update` is granted **per column**: only
  `orders.status` and `menu_items.is_available`, so even a staff session cannot change prices or totals.
- The kitchen listens to `postgres_changes` on `orders`. On every (re)subscribe it refetches all
  open orders; the database is the source of truth.
- Guests stay anonymous with **no** RLS access to orders. After a status change the Server Action
  broadcasts on `order:<uuid>`. The guest page only uses that as a trigger to re-read the order
  on the server (secret key), so a forged broadcast cannot show a wrong status.

## Consequences

- `@supabase/ssr` and cookie sessions arrive in Phase 3 instead of Phase 5. Phase 5 extends the
  same roles and policies (sessions, payments) instead of introducing them.
- Staff accounts are managed outside the app (Dashboard) until there is a staff admin screen.
- Dev and prod share one Supabase project for now; it must be split before real guests (roadmap).
