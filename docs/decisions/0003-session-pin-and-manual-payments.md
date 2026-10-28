# ADR 0003 – Session PIN instead of rotating QR tokens; cashier-confirmed payments

- Status: Accepted
- Date: 2026-10-28
- Phase: LEARNING-99 (Phase 5)

## Context

Phase 5 must stop orders from outside the restaurant ("a photographed QR code cannot place orders
once the session is closed") and add checkout with VietQR. The roadmap/Jira proposed a short-lived
session token inside the QR/URL that rotates when a session closes.

A rotating token in the URL means the printed table card changes after every table. Staff would have
to show a fresh QR (screen or reprint) for every party, and the Phase 1 cards (`/t/<code>`) become
useless. VietQR has no free, built-in way to tell us a transfer arrived.

## Decision

**Access to a table**
- Staff open a session on S1. Each session gets a random **4-digit PIN**, shown to staff only. Guests
  scan the unchanged printed QR (`/t/<code>`) and enter the PIN on the Join screen.
- No open session → 00b "This table isn't open yet" (menu viewable, no ordering).
- Wrong-PIN lockout: **5 wrong per (IP + table) per 10 minutes**, plus a ceiling of **30 wrong per
  table per 10 minutes**. The per-IP limit stops guessing; the ceiling bounds it without letting one
  person lock real guests out of their table. The IP comes from `x-forwarded-for`, which Vercel's
  edge sets (it can be spoofed only when running locally).
- Closing a session invalidates its PIN and every guest cookie (guest writes check the session is
  open). Sessions no longer expire by themselves (the Phase 4 "4 h idle" rule is removed); S1 flags
  tables open for more than 3 hours without activity.
- Order submission is rate-limited in the database: at most 5 orders per session per 10 minutes.

**Payments**
- VietQR payloads (EMVCo/NAPAS: BIN, account, amount, transfer note `TBL<table> <order>`, CRC16) are
  built in our own code and drawn with `qrcode`; no external QR image service.
- Guests only choose *full* or *split between N*; the server computes amounts. Each guest has at most
  one pending payment. Split: `split_people` is stored when the first guest splits; each share is
  `splitEvenly(remaining, unpaid people)` rounded down to 1.000đ, the last person pays the
  remainder, so the shares always add up to the bill.
- The **cashier confirms** payments on C2 (VietQR received / cash). A bank webhook for automatic
  confirmation is on the roadmap for later.
- Closing: cashier and owner may close a settled table. Only the **owner** may force-close an unpaid
  table, with a mandatory reason (`closed_reason`, `closed_by`).

## Consequences

- Printed cards never change; staff read out 4 digits instead of re-showing a QR.
- A photo of the card is useless without the PIN while the table is open, and useless after closing.
- A guest who learns the PIN can share it with someone outside, while that session is open. This is
  accepted for a small restaurant; the rate limit caps the damage.
- Payment status depends on a person checking the bank app. Reconciliation is by transfer note.
- Supersedes the "4 h idle" shortcut from Phase 4 and the "session token in URL" wording in Jira.
