# Phase 3 – Realtime kitchen display · LEARNING-97

- Dates: 2026-10-28 → (open until test #1 passes)
- Commits: `b1a06d2` (roles, RLS, publication), `4a71bf7` (sign-in, proxy), `69fcabc` (kitchen board,
  live guest status), `9f42e4a` (sold-out drawer), `e95dd97` (Start shift, chime), then the Realtime auth fix
- Decision record: [ADR 0002 – staff sign-in moved to Phase 3](../decisions/0002-staff-auth-early.md)

## What I built
- Staff roles (`staff_profiles`, `private.staff_role()`), RLS for staff, per-column update grants – `supabase/migrations/20261028200000_phase3_staff_kitchen.sql`.
- Sign-in (S0) with `@supabase/ssr` cookie sessions; `src/proxy.ts` guards `/staff/*` – `src/modules/staff/`.
- Kitchen display K1/K1b with Realtime, resync and the sold-out drawer – `src/modules/kitchen/components/kitchen-board.tsx`.
- Status changes as a compare-and-set Server Action that broadcasts to the guest – `src/modules/kitchen/actions.ts`.
- Guest status page and menu refresh themselves on Realtime signals – `src/lib/realtime-refresh.tsx`.

## Concepts I learned
**Postgres Changes and RLS.** Realtime reads the WAL and checks every row against the subscriber's
RLS policies, using the JWT the *socket* joined with. If that socket joined as `anon`, a staff-only
table produces no events at all. Nothing errors; the events just never arrive.

**Resync on (re)subscribe.** Events sent while a client is disconnected are lost; Realtime does not
replay them. So every `SUBSCRIBED` (first join and every reconnect) and every browser `online` event
re-reads all open orders and replaces the board. The database is the source of truth; events only
say "something changed".

**State machine + compare-and-set.** `pending → preparing → ready → served` lives in one map on the
server. The update is `… where id = $1 and status = $from`, so two tablets pressing the same button
produce one change, and the second one hears "already updated on another screen".

**Broadcast as a trigger, not as data.** The guest has no RLS access to orders. The server
broadcasts `{status}` on `order:<uuid>`. That channel is public, so anyone who knows the uuid could
send a fake message. The page therefore only treats a message as "re-read now" (debounced 1 s), and
the server reads the truth with the secret key. Tested: a forged `served` did not change the page.

**Column grants on top of RLS.** RLS chooses *rows*; `grant update (status)` chooses *columns*. Staff
can change a status or a sold-out flag, but not a price or a total, even with a valid session.

**Audio unlock.** Browsers only play sound after the user touches the page. "Start shift" is that
touch, and it plays a near-silent chime to unlock WebAudio.

## What was hard / what broke
- **The kitchen got no INSERT events for orders (test #1 failed).**
  - *Cause:* the `kitchen` channel subscribed before `@supabase/ssr` had loaded the session from
    cookies, so the Realtime socket joined with the **anon** JWT. RLS on `orders` only lets staff
    read, so Realtime filtered out every event, silently. Two things hid the bug:
    - Resync still worked, because REST requests send the token once the session has loaded.
    - `menu_items` events still arrived, because anon may read that table.
  - *Fix:* before creating the channel, `await supabase.auth.getSession()` and
    `await supabase.realtime.setAuth(session.access_token)`; with no session, go to sign-in. Also
    `onAuthStateChange` → on `TOKEN_REFRESHED`/`SIGNED_IN` call `realtime.setAuth(newToken)`, so the
    socket does not fall back to anon when the token refreshes (about every hour).
  - *Check:* with the board open, `select claims->>'role' from realtime.subscription;` must say
    `authenticated`, not `anon`.
  - *Lesson:* when Realtime is silent, check **who the socket is**, not only the policy.
- `staff_role()` in `public` was callable over `/rest/v1/rpc` (Security Advisor 0029). It was moved to a
  `private` schema; policies kept working because they reference the function by id.
- Leaked test sessions: browser test code containing session cookies was echoed into the log. All
  sessions were revoked. Lesson: never put tokens in tool-visible code; mint them in a local helper.
- `Date.now()` during render broke the React purity lint and would cause hydration mismatches. The
  clock now comes from `useSyncExternalStore` (null on the server, 30-second ticks in the browser).
- A flaky network can come back without the socket ever dropping, so there is no new `SUBSCRIBED`.
  The browser `online` event triggers a resync too.

## Decisions I made (and why)
- **Staff sign-in now instead of Phase 5** (ADR 0002): the alternatives meant public order data or anonymous writes.
- **The proxy checks only "signed in"; pages and actions check the role.** The proxy must not query
  the DB. Also, redirecting signed-in users *away* from sign-in would loop forever for an account
  without a staff profile.
- **Kitchen refetches an order on each event** instead of trusting the payload: the payload has no
  items, and RLS-filtered reads keep one source of truth.
- **Menu updates greyed out, not hidden**, so guests see why a dish is gone.

## Acceptance criteria check
- [ ] A new order appears on the kitchen screen within ~2 seconds, no reload. *(retest #1 after the Realtime auth fix)*
- [x] Status changes are visible to the customer. Tested: about 1.3 s, no reload; a forged broadcast is ignored.
- [x] Marking an item sold out hides it from the menu right away. Tested: greyed out in about 1.3 s, no reload.
- [x] After a dropped connection, the screen resyncs without losing orders. Tested (#2–#8).

## If I did it again
<!-- Your answers. Questions to think about:
- What would have caught the anon-socket bug before manual testing? An assertion on the socket's role, a test that inserts a row and waits for the event, or a "joined as" readout on the screen?
- Was moving staff auth into Phase 3 worth it, or would a temporary Broadcast design have been simpler for learning?
- Where should business rules live: SQL functions (place_order) or TypeScript actions (advanceOrder)? Which was easier to test and reason about?
- Which parts of "resync on reconnect" would you design differently on a real 8-hour kitchen shift?
- How would you test realtime features automatically, without signing in by hand?
-->
