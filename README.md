# TableTap – QR Ordering Starter Kit

Guests scan the QR on their table, order from their phone and pay with VietQR. The kitchen gets
orders in realtime; the owner closes bills and sees revenue.

Learn-by-building project · Jira: [LEARNING-94](https://lucenenguyen.atlassian.net/browse/LEARNING-94)

## Status: Phases 1–6 released

- **Production:** https://qr-ordering-starter-kit.vercel.app. Guests start from their table's QR
  code (`/t/<table>`); staff sign in at `/staff`.
- **All six phases are live** (released 2026-10-29):
  1. table menu;
  2. cart and orders;
  3. realtime kitchen;
  4. shared cart;
  5. table PIN, VietQR and checkout;
  6. revenue reports.
- **What was learned, phase by phase:** [`docs/lessons/`](docs/lessons/). Acceptance criteria and their
  evidence: [`docs/roadmap.md`](docs/roadmap.md). Unscheduled work: "Later" in the roadmap.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys when Phase 1 needs them
npm run dev                  # http://localhost:3000
```

Requires Node.js 22.18 or newer (or 23.6+): `npm test` runs the TypeScript unit tests directly with `node --test`, which needs built-in type stripping.

## Docs

| | |
|---|---|
| `CLAUDE.md` | How to work in this repo (for people and AI agents) |
| `docs/roadmap.md` | Phases 1–6, scope and acceptance criteria |
| `docs/architecture.md` | System design, flows, trust boundaries (+ `architecture.drawio`) |
| `docs/data-model.md` | Supabase schema and RLS, per phase |
| `docs/runbooks/` | Production release steps (Phases 5 and 6) |
| `docs/prototype/` | Clickable UI prototype – open `tabletap-prototype.html` |
| `docs/decisions/` | Architecture decision records |
| `docs/lessons/` | Lessons learned per phase |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Realtime, Auth) ·
Vercel · VietQR
