# UI / UX prototype

> [!NOTE]
> **Design reference, made before ADR 0003 and ADR 0004. The app differs:**
> - PIN join instead of rotating QR tokens;
> - Orders / Avg. per table in O2;
> - no O1 menu editor yet.
>
> Screens that differ are marked **≠ app** below. Pictures of the real app:
> [`docs/screens/app/`](../screens/app/).

`tabletap-prototype.html` is the UI reference. Open it in a browser (double-click). It has a
**Guest app** (390 px phone) and a **Staff console** (desktop/tablet) sharing one in-memory
state, so the end-to-end flow can be clicked through. Data resets on reload.

Also available as a hosted Claude artifact (private to the owner):
https://claude.ai/artifact/56pQByAEUJpVFkRfERcrag
Figma (secondary, may lag behind the prototype): https://www.figma.com/design/R0P31cqIX3WMJx0ypnVkqj

## Try it

- **Hosted with the app:** https://qr-ordering-starter-kit.vercel.app/prototype/ (after this change is
  deployed; `public/prototype/index.html`). It doesn't sign in or touch any data: everything lives in
  the page and resets on reload.
- **Locally:** open `tabletap-prototype.html` in a browser, or `npm run dev` → http://localhost:3000/prototype.

`public/prototype/index.html` is a copy of `tabletap-prototype.html`. After changing the prototype,
run `npm run prototype:sync`. `npm test` fails while the two differ.

## Screen gallery

Every screen of the prototype, by its code. Phases are LEARNING-95 (1) … LEARNING-100 (6). Screens marked
**≠ app** look different in the built app; the reason is under the picture.

To regenerate the pictures: `node scripts/capture-prototype.mjs`.

### Guest app (390 px phone)

<table>
<tr><td align="center" valign="top" width="25%"><img src="screens/00-join.png" width="180" alt="00 Join table (name, PIN)"><br><b>00</b> Join table (name, PIN)<br><sub>Phase 1, 4, 5 · <b>≠ app:</b> app also asks for the table PIN</sub></td><td align="center" valign="top" width="25%"><img src="screens/00a-notfound.png" width="180" alt="00a Table not found"><br><b>00a</b> Table not found<br><sub>Phase 1</sub></td><td align="center" valign="top" width="25%"><img src="screens/00b-closed.png" width="180" alt="00b Session not open"><br><b>00b</b> Session not open<br><sub>Phase 5 · <b>≠ app:</b> app: "This table isn't open yet", no expiring QR link</sub></td><td align="center" valign="top" width="25%"><img src="screens/01-menu.png" width="180" alt="01 Menu"><br><b>01</b> Menu<br><sub>Phase 1</sub></td></tr>
<tr><td align="center" valign="top" width="25%"><img src="screens/02-item.png" width="180" alt="02 Item detail"><br><b>02</b> Item detail<br><sub>Phase 2</sub></td><td align="center" valign="top" width="25%"><img src="screens/03-cart.png" width="180" alt="03 Shared cart"><br><b>03</b> Shared cart<br><sub>Phase 2, 4</sub></td><td align="center" valign="top" width="25%"><img src="screens/03b-failed.png" width="180" alt="03b Order failed – retry"><br><b>03b</b> Order failed – retry<br><sub>Phase 2</sub></td><td align="center" valign="top" width="25%"><img src="screens/04-status.png" width="180" alt="04 Order status"><br><b>04</b> Order status<br><sub>Phase 2, 3</sub></td></tr>
<tr><td align="center" valign="top" width="25%"><img src="screens/05-pay.png" width="180" alt="05 Pay with VietQR (full / split)"><br><b>05</b> Pay with VietQR (full / split)<br><sub>Phase 5 · <b>≠ app:</b> app: the cashier confirms the transfer, not automatic</sub></td><td align="center" valign="top" width="25%"><img src="screens/05b-pending.png" width="180" alt="05b Payment pending"><br><b>05b</b> Payment pending<br><sub>Phase 5</sub></td><td align="center" valign="top" width="25%"><img src="screens/06-success.png" width="180" alt="06 Payment received"><br><b>06</b> Payment received<br><sub>Phase 5</sub></td></tr>
</table>

### Staff console (1280 px)

<table>
<tr><td align="center" valign="top" width="50%"><img src="screens/S0-signin.png" width="400" alt="S0 Staff sign in"><br><b>S0</b> Staff sign in<br><sub>Phase 3, 5</sub></td><td align="center" valign="top" width="50%"><img src="screens/S1-tables.png" width="400" alt="S1 Tables"><br><b>S1</b> Tables<br><sub>Phase 5 · <b>≠ app:</b> app: 4-digit PIN instead of a rotating session token</sub></td></tr>
<tr><td align="center" valign="top" width="50%"><img src="screens/S1b-opensession.png" width="400" alt="S1b Open session (PIN)"><br><b>S1b</b> Open session (PIN)<br><sub>Phase 5 · <b>≠ app:</b> app: PIN, the printed QR never changes</sub></td><td align="center" valign="top" width="50%"><img src="screens/K1-kitchen.png" width="400" alt="K1 Kitchen display"><br><b>K1</b> Kitchen display<br><sub>Phase 3</sub></td></tr>
<tr><td align="center" valign="top" width="50%"><img src="screens/K1b-kdsoff.png" width="400" alt="K1b Kitchen offline / resync"><br><b>K1b</b> Kitchen offline / resync<br><sub>Phase 3</sub></td><td align="center" valign="top" width="50%"><img src="screens/C2-checkout.png" width="400" alt="C2 Checkout"><br><b>C2</b> Checkout<br><sub>Phase 5 · <b>≠ app:</b> no "Show VietQR" yet; the table QR doesn't rotate</sub></td></tr>
<tr><td align="center" valign="top" width="50%"><img src="screens/O1-menu.png" width="400" alt="O1 Menu management"><br><b>O1</b> Menu management<br><sub>Phase 1, 3 (backlog) · <b>≠ app:</b> not built yet (backlog)</sub></td><td align="center" valign="top" width="50%"><img src="screens/O1b-adddish.png" width="400" alt="O1b Add / edit dish"><br><b>O1b</b> Add / edit dish<br><sub>Phase 1, 3 (backlog) · <b>≠ app:</b> not built yet (backlog)</sub></td></tr>
<tr><td align="center" valign="top" width="50%"><img src="screens/O2-reports.png" width="400" alt="O2 Revenue reports"><br><b>O2</b> Revenue reports<br><sub>Phase 6 · <b>≠ app:</b> app: "Orders" and "Avg. per table" (ADR 0004)</sub></td><td align="center" valign="top" width="50%"><img src="screens/O2b-noaccess.png" width="400" alt="O2b Reports · cashier (no access)"><br><b>O2b</b> Reports · cashier (no access)<br><sub>Phase 6</sub></td></tr>
<tr><td align="center" valign="top" width="50%"><img src="screens/O3-settings.png" width="400" alt="O3 Settings · VietQR bank account"><br><b>O3</b> Settings · VietQR bank account<br><sub>Phase 5 · <b>≠ app:</b> app: manual confirmation only, no bank webhook</sub></td><td align="center" valign="top" width="50%"><img src="screens/O4-settings-qr.png" width="400" alt="O4 Settings · Tables & QR cards"><br><b>O4</b> Settings · Tables & QR cards<br><sub>Phase 1</sub></td></tr>
</table>

## Design tokens

Same values as `src/app/globals.css` (`@theme`). Font: Be Vietnam Pro 400/500/600/700.
Brand `#E8590C`, brand-strong `#C2410C`, text `#1C1A17`, muted `#6E6860`, surface `#F6F4F0`,
surface-brand `#FFF1E8`, border `#E8E3DC`, success `#2B8A3E`.
