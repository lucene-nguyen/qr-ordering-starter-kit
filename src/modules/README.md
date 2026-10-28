# Domain modules

Code is organised by **business domain**, not by technical layer. Each module owns its
types, data access, Server Actions and UI pieces. Routes in `src/app` stay thin and call into
modules.

```
src/modules/<module>/
├── components/     UI used by this domain (React Server/Client Components)
├── actions.ts      Server Actions ("use server") – the only place that writes
├── queries.ts      Read functions (server-side Supabase queries)
├── schema.ts       Zod schemas for input validation
└── types.ts        Domain types
```

| Module | Owns | First phase |
|---|---|---|
| `menu` | categories, dishes, sizes, add-ons, sold-out flag | 1 |
| `table-session` | tables, sessions, QR tokens, guests at a table | 1, 4, 5 |
| `orders` | cart, order submission, idempotency, order status | 2, 4 |
| `kitchen` | kitchen display, realtime subscription, status transitions | 3 |
| `payments` | bill, split, VietQR payload, payment records, closing a table | 5 |
| `reports` | revenue aggregates, best sellers, CSV export | 6 |
| `staff` | staff sign-in, roles (`requireStaff`, `CAN`), no-access screen | 3 (ADR 0002), 5 |

Rules
- A module may import another module's **types, queries and presentational components** (e.g. `DishPhoto`), never its internals (actions, state).
- Writes go through Server Actions; never trust prices or totals sent by the client.
- Money is an integer number of VND (`number`, no decimals).
