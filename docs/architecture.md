# Architecture

Diagram: `docs/architecture.drawio` (open in draw.io desktop or https://app.diagrams.net).

```
Clients ─ Customer phone (scans table QR) · Kitchen tablet · Owner/Cashier laptop
   │ HTTPS
Next.js App on Vercel (App Router, Server Components, Server Actions)
   │
Domain modules ─ Menu · Table & Session · Orders · Kitchen · Payments · Reports
   │                                  │                       │
Supabase PostgreSQL (data + RLS)   Supabase Realtime        VietQR (bank transfer QR)
Supabase Auth (staff roles)        (orders, cart changes)
```

## Request flows

**Guest orders (Phases 1–2, 4–5)**
1. Guest scans `https://<app>/t/05?s=<session-token>` printed on Table 05.
2. Server Component loads table + open session + menu; renders the menu.
3. "Place order" calls a Server Action with `{ sessionToken, idempotencyKey, lines[] }`.
4. Server Action validates with Zod, checks the session is open and rate limits, recomputes
   prices from the DB, inserts `orders` + `order_items` in one transaction, returns the order.
5. The insert is broadcast by Supabase Realtime to the kitchen.

**Kitchen (Phase 3)**
- Client Component subscribes to `orders` changes; on reconnect it refetches open orders to
  resync anything missed. Status buttons call Server Actions (`advanceOrder`).

**Checkout (Phase 5)**
- Bill = sum of `order_items` for the session. VietQR payload = bank + account + amount +
  transfer note `TBL{table} {orderNo}`. Payments are recorded (VietQR confirmed or cash).
  Closing the table marks the session closed and issues a new token, so old QR photos fail.

**Reports (Phase 6)**
- SQL views aggregate paid sessions by day in `Asia/Ho_Chi_Minh`; owner-only via RLS.

## Trust boundaries

| Actor | Auth | Can |
|---|---|---|
| Guest | none; holds a session token | read menu; write cart/orders for **their open session only** (via Server Actions) |
| Kitchen | Supabase Auth, role `kitchen` | read open orders; advance status; mark sold out |
| Cashier | role `cashier` | tables, sessions, checkout, payments, menu availability |
| Owner | role `owner` | everything, incl. reports and settings |

Guest writes never use the anon key directly against tables; they go through Server Actions
that use the service role **after** validating the session token.

## Cost

Vercel Hobby + Supabase Free cover a few small restaurants. The only fixed cost is a domain
(~300.000đ/year). VietQR codes are generated from the open NAPAS/VietQR format, no fee.
