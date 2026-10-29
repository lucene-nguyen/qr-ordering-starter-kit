import { expect, test } from "@playwright/test";
import { account, addDish, forceClose, guest, join, missingAccount, openTable, panelOf, placeOrder, staff } from "./helpers";

// Pictures of the REAL app for README.md (docs/screens/app/). Not part of the normal run:
// `E2E_SCREENS=1 npx playwright test app-screens` on dev, with the R1 history from
// supabase/dev/seed-reports.sql for O2.
// Nothing secret in the pictures: the PIN is only read to let the guest join and is hidden on the
// S1 picture; the bank account is the demo account from seed.sql.
const out = (name: string) => `docs/screens/app/${name}.png`;

test.describe("README app screens", () => {
  test.skip(!process.env.E2E_SCREENS, "set E2E_SCREENS=1 to take the README pictures");

  test("00 join, 05 pay, S1 tables, O2 reports", async ({ browser }) => {
    test.setTimeout(120_000);
    for (const role of ["owner", "cashier"] as const) test.skip(!account(role), missingAccount(role));
    const owner = await staff(browser, "owner");
    const cashier = await staff(browser, "cashier");
    const lan = await guest(browser);

    await forceClose(owner, "05", "README screens: clean start");
    const pin = await openTable(cashier, "05");

    // 00 · Join, before anything is typed
    await lan.goto("/t/05");
    await expect(lan.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
    await lan.screenshot({ path: out("00-join") });

    await join(lan, "05", "Lan", pin);
    await addDish(lan, "05", "Phở bò tái", 2);
    await addDish(lan, "05", "Trà đá chanh", 2);
    await placeOrder(lan, "05");

    // 05 · VietQR for the demo bank account
    await lan.goto("/t/05/pay");
    await lan.getByRole("button", { name: "Show payment QR" }).click();
    await expect(lan.getByRole("img", { name: /VietQR code for/ })).toBeVisible();
    await lan.screenshot({ path: out("05-pay"), fullPage: true });

    // S1 · a fresh page, so the PIN is still hidden
    const s1 = await staff(browser, "cashier");
    await s1.goto("/staff/tables?table=05");
    const panel = panelOf(s1, "05");
    await expect(panel.getByRole("button", { name: "Show the PIN of Table 05" })).toBeVisible();
    await expect(panel.getByText(/^\d{4}$/)).toHaveCount(0);
    await s1.screenshot({ path: out("S1-tables") });

    // O2 · 30 days of seeded history (table R1)
    await owner.goto("/staff/reports?range=30d&grain=day");
    await expect(owner.getByRole("region", { name: "Best sellers" })).toBeVisible();
    await owner.screenshot({ path: out("O2-reports"), fullPage: true });

    await forceClose(owner, "05", "README screens: cleanup");
  });
});
