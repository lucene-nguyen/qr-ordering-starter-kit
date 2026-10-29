# Architecture

![TableTap system design: clients, the Next.js app on Vercel with its domain modules, Supabase, the guest's bank, and the dev/prod environments](architecture.svg)

The source is `docs/architecture.drawio` (draw.io desktop or https://app.diagrams.net). After editing it, run
`node scripts/export-architecture.mjs` to regenerate `architecture.svg`.

## Sequence diagrams

**(a) Guest joins with the PIN, orders, and the kitchen sees it**

```mermaid
sequenceDiagram
    autonumber
    actor C as Cashier (S1)
    actor G as Guest phone
    participant N as Next.js server
    participant DB as Postgres
    participant RT as Realtime
    actor K as Kitchen tablet

    C->>N: openSession(table 05)
    N->>DB: insert table_sessions (RLS: owner or cashier)
    DB-->>N: open session with a random 4-digit PIN
    Note over C,G: The cashier tells the guests the PIN
    G->>N: GET /t/05 (scans the printed QR)
    N-->>G: 00 Join: name and PIN
    G->>N: joinTable(name, PIN)
    N->>DB: join_table(code, name, pin, ip) as service_role
    alt wrong PIN
        DB-->>N: WRONG_PIN and tries left (5 per IP, 30 per table, 10 min)
        N-->>G: Wrong PIN, n tries left
    else right PIN
        DB-->>N: guest_id
        N-->>G: httpOnly tt_guest cookie, then 01 Menu
    end
    G->>N: addToCart(line), Zod first
    N->>DB: cart_add(code, guest, line)
    N->>RT: broadcast session:{id} cart
    RT-->>G: the table's other phones re-read the shared cart
    G->>N: placeRound(cart version)
    N->>DB: place_session_order: prices from the DB, at most 5 rounds in 10 min
    DB-->>N: order A-0123
    DB--)RT: orders INSERT (postgres_changes)
    RT--)K: new order
    K->>N: re-read open orders (RLS: kitchen)
    N-->>G: 04 Order status
```

**(b) Request bill: VietQR, the cashier confirms, the guest sees "Paid"**

```mermaid
sequenceDiagram
    autonumber
    actor G as Guest phone
    participant N as Next.js server
    participant DB as Postgres
    participant RT as Realtime
    actor C as Cashier (C2)
    participant B as Guest's bank app

    G->>N: Request bill, GET /t/05/pay
    N->>DB: guest_bill(code, guest) as service_role
    alt no bank account in restaurant_settings
        DB-->>N: amount_open, bank_ready = false
        N-->>G: Pay at the counter, amount owed (no payment row)
        Note over G,C: The cashier records cash on C2 (no transfer warning)
    else bank account set
        DB-->>N: amount_open, bank_ready = true
        N-->>G: 05 Full bill or Split equally
        G->>N: requestPayment(mode, people)
        N->>DB: request_payment: pending VietQR payment, amount and note TBL05 A0123 computed here
        N->>RT: broadcast session:{id} payment
        RT--)C: C2 shows Awaiting
        G->>N: GET /t/05/pay/{payment}
        N->>DB: guest_payment_qr(code, guest, payment) with the publishable key
        DB-->>N: bank, account, amount, note (only this guest's pending payment)
        N-->>G: VietQR drawn as SVG on the server
        G->>B: scan and transfer
        G->>N: I've completed the transfer
        N-->>G: 05b Waiting for the cashier
        C->>B: checks the bank app
        C->>N: confirmPayment(payment)
        N->>DB: update payments set status = confirmed (trigger stamps who and when)
        N->>RT: broadcast session:{id} payment
        RT--)G: doorbell
        G->>N: re-read the payment
        N-->>G: 06 Payment received
    end
```

**(c) Close the table, then the owner sees it in O2**

```mermaid
sequenceDiagram
    autonumber
    actor C as Cashier or owner (C2)
    participant N as Next.js server
    participant DB as Postgres
    participant RT as Realtime
    actor G as Guest phone
    actor O as Owner (O2)

    C->>N: closeSession(session, reason)
    N->>DB: update table_sessions set status = closed
    Note over DB: Trigger: still owing means UNPAID, unless the owner gives a reason.<br/>Stamps closed_at and closed_by, cancels pending payments.
    alt bill not settled and not the owner
        DB-->>N: UNPAID
        N-->>C: Only the owner can close an unpaid table
    else settled, or owner force-close with a reason
        DB-->>N: closed
        N->>RT: broadcast session:{id} closed
        RT--)G: phone moves to 00b, the PIN and cookie stop working
    end
    O->>N: GET /staff/reports?range=7d&grain=day
    N->>DB: report_revenue (period, previous period, today), report_items, report_hours as the owner
    Note over DB: security invoker, owner only, otherwise NOT_ALLOWED.<br/>Revenue = confirmed payments of closed tables, by closed_at day in Asia/Ho_Chi_Minh.
    DB-->>N: rows per day, dishes, hours, unpaid
    N-->>O: KPIs vs the previous period, bars, best sellers, Unpaid banner
    O->>N: Export CSV
    N-->>O: same figures as CSV (UTF-8 BOM, CRLF, formula guard)
```

## Request flows

**Guest orders (Phases 1–2, 4–5)**
1. Staff open the table's session on S1; the database gives it a 4-digit PIN (ADR 0003).
2. Guest scans `https://<app>/t/05` (the printed QR never changes) and joins with name + PIN.
   `join_table` checks the PIN and the wrong-PIN limits; the server sets the httpOnly `tt_guest`
   cookie (the guest's id – the only guest credential).
3. Cart changes and "Place order" are Server Actions: Zod, then the guest's open session from the
   cookie, then a service_role function that prices from the DB, rate-limits rounds and writes
   in one transaction. A broadcast on `session:<id>` makes the table's other phones re-read.
4. The new order reaches the kitchen through Realtime.

**Kitchen (Phase 3)**
- Client Component subscribes to `orders` changes; on reconnect it refetches open orders to
  resync anything missed. Status buttons call Server Actions (`advanceOrder`).

**Checkout (Phase 5)**
1. Guest taps Request bill → 05: full bill or an equal share. `request_payment` creates a pending
   payment; the database computes the amount and the transfer note `TBL{table} {first order}`.
2. The QR is drawn on the server from `guest_payment_qr` (publishable key; only this guest's pending
   payment in an open session) with the bank account from `restaurant_settings`. No account → "Pay at
   the counter".
3. The cashier sees the request live on C2 (`postgres_changes`), checks the bank app and presses
   Confirm received – or records cash, which withdraws awaiting requests after a confirmation dialog.
   Each change broadcasts `payment` on `session:<id>`; the guest's phone moves to 06 by itself.
4. Close table once settled (the owner may force-close with a reason). Closing ends the PIN and every
   guest cookie of the session, so a photographed QR cannot order any more.

**Reports (Phase 6, ADR 0004)**
1. O2 (`/staff/reports`, owner) calls `report_revenue` (current period, previous period, today),
   `report_items` and `report_hours` in parallel with the staff member's session.
   - The functions run as the caller and refuse anyone but the owner.
   - Other roles get O2b.
2. Revenue = confirmed payments of tables closed in the period, grouped by closing day, week or
   month in `Asia/Ho_Chi_Minh`. The page uses the same zone to decide "today".
3. "Export CSV" (`/staff/reports/export`, route handler, owner only) returns the same figures:
   UTF-8 with BOM, CRLF, and formula injection blocked.
4. No Realtime: the owner reloads or switches the period. Figures only change when a table closes.

## Trust boundaries

| Actor | Auth | Can |
|---|---|---|
| Guest | none; `tt_guest` cookie after joining with the session PIN | read menu; write cart/orders and ask to pay for **their open session only** (via Server Actions) |
| Kitchen | Supabase Auth, role `kitchen` | read open orders; advance status; mark sold out |
| Cashier | role `cashier` | tables, sessions, checkout, payments, menu availability |
| Owner | role `owner` | everything, incl. reports and settings |

Guest writes never use the anon key directly against tables; they go through Server Actions
that call service_role functions **after** checking the guest cookie. The one guest read with the
publishable key is `guest_payment_qr`, which checks the guest and payment itself.
Deployments: Production uses the prod Supabase project, Preview/Development the dev project; a
Preview that points at prod shows a red warning and refuses every write (`src/lib/db-target.ts`).

## Cost

Vercel Hobby + Supabase Free cover a few small restaurants. The only fixed cost is a domain
(~300.000đ/year). VietQR codes are generated from the open NAPAS/VietQR format, no fee.
