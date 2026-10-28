# Phase 1 – Table-based menu · LEARNING-95

- Dates: 2026-10-28 → 2026-10-28
- Live: https://qr-ordering-starter-kit.vercel.app/t/01
- Commits: `522d8bc` (scaffold + Phase 1), `67ce24a` (QR origin fix)

## What I built
- Schema `categories`, `menu_items`, `tables` with RLS – `supabase/migrations/20261028000000_phase1_menu.sql`, demo data in `supabase/seed.sql`.
- Guest menu `/t/[tableId]` (screen 01): table badge, category chips, search, "Popular today", sold-out dishes greyed out – `src/app/t/[tableId]/page.tsx`.
- "Table not found" page (00a) – `src/app/t/[tableId]/not-found.tsx`; item page, view only (02) – `src/app/t/[tableId]/item/[itemId]/page.tsx`.
- Printable QR cards with the logo in the middle (O4) – `src/app/staff/settings/qr/page.tsx`, `src/modules/table-session/components/table-qr-card.tsx`.

## Concepts I learned
**Dynamic route + Server Component.** `/t/[tableId]` is one file for every table. The page is an
`async` component that runs on the server, so it queries Supabase directly. No API route, no
loading spinner, and no data-fetching code ships to the phone. In Next 16 `params` and
`searchParams` are Promises, so the page `await`s them.

**`notFound()` and `not-found.tsx`.** Calling `notFound()` stops rendering, returns HTTP 404 and
shows the nearest `not-found.tsx`. That file gets no props, so it reads the table code with
`useParams()`, which makes it a Client Component.

**Static vs dynamic rendering.** `next build` prerenders any page that uses no request data. The
QR page did not, so it was frozen with the tables that existed at build time. `await connection()`
tells Next to render it per request. Check the `○`/`ƒ` markers in the build output.

**Row Level Security.** RLS is on for every table, with only `select` policies. The publishable
key in the browser or server can read the menu but cannot write anything. Inactive tables are
hidden by the policy itself (`using (is_active)`), not by app code.

**QR error correction.** Level `H` keeps the code readable with ~30% of it covered, which is why a
logo can sit in the middle. It is the same idea as the reference `qr-tool` (qrcode + sharp), but
the logo is laid over with CSS instead of merged into a PNG, so there is no native `sharp` dependency.

## What was hard / what broke
- The QR page showed as `○ (Static)` in the build, so newly added tables would never appear. Fixed with `connection()`.
- Searching "pho" did not match "Phở". Fixed by folding accents before comparing (`normalize("NFD")` + strip marks + `đ → d`).
- **After deploying, the QR cards pointed to `localhost:3000`.** `NEXT_PUBLIC_*` variables are
  copied into the code at *build* time, so a missing or wrong value on Vercel gets baked into every
  build. Fix: build the link from the request's own host (`headers()`), so there is no
  base-URL setting at all – localhost, preview and production each print their own links.
- A malformed item id (`/item/abc`) would make Postgres throw "invalid uuid" (500). The query checks the uuid shape first, and the page sends a stale link back to the menu.

## Decisions I made (and why)
- **URL uses `tables.code` ('05'), not the uuid.** It is short to print and stable even if the label changes.
- **Sizes/add-ons moved to Phase 2.** Not in LEARNING-95 scope; `docs/data-model.md` updated.
- **Search is a plain GET form (`?q=`)** filtered on the server, so it works without client JS.
- **Only `@supabase/supabase-js`, not `@supabase/ssr`.** Phase 1 has no logins, so there are no cookies to manage.
- **Join screen (00) skipped.** It needs sessions/names (Phase 4); the QR opens the menu directly.

## Acceptance criteria check
- [x] Scanning the QR for table 1 opens the menu and shows "Table 1" – `/t/01` shows the "Table 01" badge.
- [x] An invalid table ID shows a friendly error page – `/t/99` returns 404 with the 00a screen.
- [x] Items marked unavailable are hidden or greyed out – Chè ba màu is greyed with "Sold out".
- [x] The app is live on a Vercel URL – https://qr-ordering-starter-kit.vercel.app/

## If I did it again
<!-- fill in after deploying -->
