# Phase 2 – Cart and order submission · LEARNING-96

- Dates: 2026-10-28 → 2026-10-28
- Commits: `c7556c1` (schema + `place_order`), then the cart/order UI commit

## What I built
- Item options (size, add-ons, note, qty) and "Add to cart" – `src/modules/orders/components/item-order-form.tsx`.
- Cart kept in `localStorage` per table – `src/modules/orders/cart.ts`; cart bar on the menu, cart screen with the failure banner and "Try again" – `cart-view.tsx`.
- Server Action `placeOrder` (Zod → Postgres function) – `src/modules/orders/actions.ts`, `schema.ts`.
- `place_order` in `supabase/migrations/20261028100000_phase2_orders.sql`: one transaction that prices, snapshots and inserts the order.
- Order status screen (received state) – `src/app/t/[tableId]/order/[orderId]/page.tsx`.

## Concepts I learned
**Idempotency key.** The phone makes a random id (`crypto.randomUUID()`) the first time a cart is
submitted and sends it with every retry of that same cart. The database has
`unique (idempotency_key)`, and `place_order` returns the existing order when it sees a key again.
So "did my order go through?" never becomes two orders, whether the cause is a double tap, a
timeout or a manual retry. The key is thrown away as soon as the cart changes, because that is a
different order.

**Why `on conflict do nothing` and not "check, then insert".** Two requests with the same key can
arrive at the same moment, and both "checks" would see nothing. With
`insert … on conflict (idempotency_key) do nothing`, Postgres makes the second insert wait for the
first, then skip it. The function then returns the winner's order.

**Never trust the client's prices.** The phone sends only ids, quantities and notes; prices are not
even in the Zod schema. `place_order` reads base price + size + add-ons from the tables, so a
tampered request cannot change what is charged. It also checks that the size and add-ons belong to
that dish and that the dish is not sold out.

**Snapshotting.** `order_items` stores `name_snapshot`, `unit_price`, `size_name` and the add-on
names/prices *as they were*. Renaming a dish or raising its price tomorrow does not rewrite old
orders or yesterday's revenue.

**One transaction via a Postgres function.** supabase-js has no multi-statement transactions. Putting
the whole write in one `plpgsql` function makes it atomic: if line 3 fails (sold out), the order
and lines 1–2 are rolled back too. `revoke execute … from anon` means only the server (secret key)
can call it.

**Server Action + Zod.** A Server Action is a server function the client calls like a normal async
function. Its input arrives from the internet, so `safeParse` is the trust boundary. It returns
`{ ok: false, message }` for errors the guest can fix. A *thrown* error on the client means the
request never got an answer (offline), which is when the "Try again" banner appears.

**`useSyncExternalStore`.** It lets React read the cart from `localStorage` without a Context provider.
The server snapshot is `null`, so screens show nothing until the browser has read storage, instead
of flashing "Your cart is empty".

**`server-only`.** `src/lib/supabase/admin.ts` imports it, so the build fails if the secret-key
client ever ends up in a Client Component. Checked: the key is not in `.next/static`.

## What was hard / what broke
- Finding the bug class before it happened: the first idea of "select by key, insert if missing"
  is racy. Replaced with `on conflict`.
- `notFound()` on the order page would have shown "We can't find Table 05" for a bad *order* id, so
  it redirects to the menu instead.

## Decisions I made (and why)
- **Business logic in SQL (`place_order`)** instead of TypeScript: atomic, one round trip, no race.
- **Cart in localStorage, not the database.** That is enough for one phone. The shared, synced cart is Phase 4 (`cart_items`).
- **Order status reads with the secret key; the order uuid in the URL is the access token.** Guests
  have no RLS access to `orders`. Phase 5 ties this to the table session.
- **Skipped:** "Added by"/shared banner (Phase 4), "Already ordered" and "Request bill" (Phase 4/5),
  quick-add "+" on menu rows, and a "Track your order" link from the menu.

## Acceptance criteria check
- [x] Tapping "Submit" several times creates exactly one order. Tested: offline submit, then a double-click on "Try again" left 1 order, which carried the key of the failed attempt. Also tested in SQL.
- [x] Order totals are calculated server-side – 2 × (65.000 + 15.000 + 20.000) + 15.000 = 215.000đ, computed by `place_order`.
- [x] Notes are saved per item – "No onion, please" stored on the phở line only.
- [x] A network failure shows a retry option without losing the cart – banner + "Try again", cart still in storage.

## If I did it again
<!-- fill in -->
