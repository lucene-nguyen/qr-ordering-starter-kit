# CLAUDE.md – TableTap (QR Ordering Starter Kit)

Guidance for Claude (and any coding agent) working in this repository. Read this first, then the
doc that matches the task.

## What we are building

A web app where restaurant guests scan the QR code on their table, view the menu and order
without installing anything. The kitchen receives orders in realtime; the owner/cashier handles
checkout (VietQR or cash) and sees revenue. Fictional restaurant used everywhere: **Phở Mây
Kitchen**, demo table **Table 05**.

This is a **learn-by-building** project and one of a series of domain starter kits. The owner
(Cuong) is learning through it, so:
- Work in small, reviewable steps. Explain *why* for each non-obvious decision in plain words.
- When a phase introduces a concept (idempotency, realtime, RLS…), say what it is and where it
  shows up in the code.
- At the end of every phase, write `docs/lessons/phase-N.md` from `docs/lessons/_template.md`.

## Where the requirements live

| What | Where |
|---|---|
| Phases, scope, acceptance criteria | `docs/roadmap.md` (mirror of Jira) |
| Jira | Epic **LEARNING-3** → Task **LEARNING-94** → Subtasks **LEARNING-95 … LEARNING-100** at https://lucenenguyen.atlassian.net. If the Atlassian MCP is available, read the subtask before starting and move it to In Progress / Done when appropriate. |
| Architecture | `docs/architecture.md`, diagram `docs/architecture.drawio` |
| Data model | `docs/data-model.md` (proposed schema + RLS plan) |
| UI / UX | `docs/prototype/tabletap-prototype.html` – open it in a browser. It is the **source of truth for screens, copy and behaviour**. Map of screens → phases in `docs/prototype/README.md`. |
| Decisions | `docs/decisions/` (ADRs) |
| Supabase | Project **tabletap** (ref `sxwcsxyalzblvkhtlola`, region ap-southeast-1, Free plan). Keys in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). |

When the user says "work on LEARNING-9x", read that phase in `docs/roadmap.md` (and Jira if
reachable), check the matching prototype screens, then plan before coding.

## Tech stack

- **Next.js** (App Router, Server Components, Server Actions), **TypeScript** strict
- **Tailwind CSS v4** – tokens in `src/app/globals.css` (`bg-brand`, `text-muted`, `rounded-md`, `text-display` …). Do not hard-code hex colours.
- **Supabase** – PostgreSQL, Realtime, Auth (staff only). Migrations in `supabase/migrations/`.
- **Vercel** – hosting (free tier). **VietQR** – bank-transfer QR payments.
- Add libraries only when a phase needs them (expected: `@supabase/supabase-js`, `@supabase/ssr`, `zod`). Ask before adding anything else.

## Commands

```bash
npm install        # first time
npm run dev        # http://localhost:3000
npm run build      # must pass before a phase is marked done
npm run lint
npm run typecheck
```

## Project structure

```
src/
  app/                 routes only – thin pages/layouts that call into modules
    t/[tableId]/       guest app (Phase 1+)
    staff/             staff console (Phase 3+)
  modules/             one folder per domain (see src/modules/README.md)
    menu/ table-session/ orders/ kitchen/ payments/ reports/
  lib/                 domain-free helpers (supabase clients, money, time)
docs/                  roadmap, architecture, data model, prototype, decisions, lessons
supabase/              migrations and seed
```

## Conventions

- **Language:** English for code, comments, commits, docs and UI copy (UI copy follows the prototype).
- **Money:** integer VND (`65000`), format with a shared helper as `65.000đ`. Never floats.
- **Time:** store UTC (`timestamptz`); group and display in `Asia/Ho_Chi_Minh` (`APP_TIMEZONE`).
- **Writes:** only through Server Actions. Validate input with Zod. Recompute prices and totals on the server; snapshot dish name and unit price into `order_items`.
- **Guests are anonymous.** Every guest write must check an **open table session** via its token (Phase 5 hardens this; design for it from Phase 1).
- **Order submission is idempotent** (client-generated idempotency key, unique in DB).
- **Secrets:** only in `.env.local` / Vercel env. `SUPABASE_SECRET_KEY` is server-only and must never reach a Client Component.
- **Components:** Server Components by default; add `"use client"` only for interactivity. Mobile-first for the guest app (390 px), desktop/tablet for staff.
- **Accessibility:** real buttons/links, labels on inputs, visible focus.
- **Commits:** small, imperative, prefixed with the Jira key, e.g. `LEARNING-95: add table menu route`.

## Definition of Done (per phase)

1. Every acceptance criterion for the phase in `docs/roadmap.md` is met and was checked.
2. `npm run build`, `npm run lint` and `npm run typecheck` pass.
3. Screens match the prototype (layout, copy, states).
4. Migrations are committed; nothing secret is committed.
5. `docs/lessons/phase-N.md` is written; Jira subtask updated.

## Do not

- Do not build ahead of the current phase without asking.
- Do not commit `.env*` (except `.env.example`), real bank details or keys.
- Do not disable RLS to "make it work"; fix the policy.
