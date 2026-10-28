# ADR 0001 – Tech stack: Next.js + Supabase + Vercel + VietQR

- Status: Accepted
- Date: 2026-10-28

## Context

Guests must order from their phone without installing an app. The project is built by one
learner, should cost close to nothing to run, and must show realtime updates (kitchen, shared
cart).

## Decision

- **Next.js (App Router)** for both UI and backend (Server Components + Server Actions): one
  codebase, one deploy, no separate API server.
- **Supabase** for PostgreSQL, Realtime and Auth: relational data fits menus/orders; Realtime
  gives kitchen updates without running a WebSocket server; free tier.
- **Vercel** for hosting: native Next.js support, free Hobby tier, preview deploys per branch.
- **VietQR** for payments: guests already use banking apps; no payment-gateway fee.

## Consequences

- Vendor coupling to Supabase (acceptable for a starter kit; it is Postgres underneath).
- Realtime and RLS have to be learned properly (Phases 3 and 5).
- VietQR has no built-in confirmation; Phase 5 needs a confirmation path (bank webhook or
  cashier confirmation).
