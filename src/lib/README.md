# lib

Shared, domain-free helpers only, for example:
- `supabase/server.ts`, `supabase/client.ts` – Supabase clients (added in Phase 1)
- `money.ts` – `formatVnd(65000) → "65.000đ"`
- `time.ts` – helpers that use `APP_TIMEZONE`

Anything that knows about menus, orders or tables belongs in `src/modules`.
