# TableTap – QR Ordering Starter Kit

Guests scan the QR on their table, order from their phone and pay with VietQR. The kitchen gets
orders in realtime; the owner closes bills and sees revenue.

Learn-by-building project · Jira: [LEARNING-94](https://lucenenguyen.atlassian.net/browse/LEARNING-94)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys when Phase 1 needs them
npm run dev                  # http://localhost:3000
```

Requires Node.js 20.9 or newer.

## Docs

| | |
|---|---|
| `CLAUDE.md` | How to work in this repo (for people and AI agents) |
| `docs/roadmap.md` | Phases 1–6, scope and acceptance criteria |
| `docs/architecture.md` | System design, flows, trust boundaries (+ `architecture.drawio`) |
| `docs/data-model.md` | Proposed Supabase schema and RLS plan |
| `docs/prototype/` | Clickable UI prototype – open `tabletap-prototype.html` |
| `docs/decisions/` | Architecture decision records |
| `docs/lessons/` | Lessons learned per phase |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Realtime, Auth) ·
Vercel · VietQR
