import { expect, test } from "@playwright/test";
import { account, missingAccount, signIn, signOutIfSignedIn } from "./helpers";

// O3 · Settings › Payment (LEARNING-99). Saves the dev bank details back unchanged.
test.describe("O3 · payment settings", () => {
  test.afterEach(async ({ page }) => signOutIfSignedIn(page));

  test("a cashier cannot open payment settings", async ({ page }) => {
    const cashier = account("cashier");
    test.skip(!cashier, missingAccount("cashier"));
    await signIn(page, cashier!, "/staff/settings");
    await expect(page.getByRole("heading", { name: "Settings are for the owner" })).toBeVisible();
  });

  test("the owner saves bank details (normalised, checked) and sees a scannable preview", async ({ page }) => {
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await signIn(page, owner!, "/staff/settings");
    await expect(page.getByRole("heading", { name: "Bank account for VietQR" })).toBeVisible();
    const holder = page.getByLabel("Account holder name (as printed by the bank)");
    const number = page.getByLabel("Account number");
    const savedHolder = await holder.inputValue();
    const savedNumber = await number.inputValue();
    test.skip(!savedHolder, "dev has no restaurant_settings row – run the Phase 5 part of seed.sql");

    // A bad account number is refused and nothing is saved
    await number.fill("12ab");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "account number" })).toHaveText("The account number is 6–19 digits.");
    await expect(number).toHaveValue("12ab"); // what the owner typed stays

    // Lower case is turned into what the bank prints
    await number.fill(savedNumber);
    await holder.fill(savedHolder.toLowerCase());
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await expect(holder).toHaveValue(savedHolder);

    const preview = page.getByRole("region", { name: "Guest preview" });
    await expect(preview.getByRole("img", { name: "VietQR code for 10.000đ" })).toBeVisible();
    await expect(preview).toContainText(savedHolder);
    await page.screenshot({ path: "test-results/screens/O3-settings-payment.png", fullPage: true });
  });
});
