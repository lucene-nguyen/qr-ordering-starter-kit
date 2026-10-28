# UI / UX prototype

`tabletap-prototype.html` is the UI reference. Open it in a browser (double-click). It has a
**Guest app** (390 px phone) and a **Staff console** (desktop/tablet) sharing one in-memory
state, so the end-to-end flow can be clicked through. Data resets on reload.

Also available as a hosted Claude artifact (private to the owner):
https://claude.ai/artifact/56pQByAEUJpVFkRfERcrag
Figma (secondary, may lag behind the prototype): https://www.figma.com/design/R0P31cqIX3WMJx0ypnVkqj

## Screen map

| Code | Screen | Phase / Jira |
|---|---|---|
| 00 | Join table (name) | 1 (layout), 4 (name) · LEARNING-95/98 |
| 00a | Table not found | 1 · LEARNING-95 |
| 00b | Session not open / QR expired | 5 · LEARNING-99 |
| 01 | Menu (categories, search, sold out, cart bar) | 1 · LEARNING-95 |
| 02 | Item detail (size, add-ons, note, qty) | 2 · LEARNING-96 |
| 03 | Cart (shared, "Added by") | 2, 4 · LEARNING-96/98 |
| 03b | Order failed – retry | 2 · LEARNING-96 |
| 04 | Order status (received → preparing → ready → served) | 2, 3 · LEARNING-96/97 |
| 05 | Pay with VietQR (full / split) | 5 · LEARNING-99 |
| 05b | Payment pending / not received | 5 · LEARNING-99 |
| 06 | Payment success | 5 · LEARNING-99 |
| S0 | Staff sign in (roles) | 5 · LEARNING-99 |
| S1 / S1b | Tables, Open session | 5 · LEARNING-99 |
| K1 / K1b | Kitchen display, offline/resync, sold-out drawer | 3 · LEARNING-97 |
| C2 | Checkout (payments, cash, close table) | 5 · LEARNING-99 |
| O1 / O1b | Menu management, Add/Edit dish | 1, 3 · LEARNING-95/97 |
| O2 / O2b | Revenue reports, cashier no-access | 6 · LEARNING-100 |
| O3 / O4 | Settings: VietQR bank account, Tables & QR cards | 5, 1 · LEARNING-99/95 |

## Design tokens

Same values as `src/app/globals.css` (`@theme`). Font: Be Vietnam Pro 400/500/600/700.
Brand `#E8590C`, brand-strong `#C2410C`, text `#1C1A17`, muted `#6E6860`, surface `#F6F4F0`,
surface-brand `#FFF1E8`, border `#E8E3DC`, success `#2B8A3E`.
