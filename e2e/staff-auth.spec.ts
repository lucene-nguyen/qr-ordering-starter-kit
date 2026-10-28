import { expect, test } from "@playwright/test";
import { account, fillSecret, missingAccount, signIn, signOutIfSignedIn } from "./helpers";

// S0 · Staff sign-in, src/proxy.ts guard and role checks (LEARNING-97, ADR 0002).
test.describe("S0 · staff sign-in", () => {
  test.afterEach(async ({ page }) => signOutIfSignedIn(page));

  test("signed-out visitors on /staff/* are sent to sign-in", async ({ page }) => {
    await page.goto("/staff/kitchen");
    await expect(page).toHaveURL(/\/staff\/sign-in\?next=%2Fstaff%2Fkitchen$/);
    await page.goto("/staff/settings/qr");
    await expect(page).toHaveURL(/\/staff\/sign-in\?next=%2Fstaff%2Fsettings%2Fqr$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password shows an error and stays on sign-in", async ({ page }) => {
    const kitchen = account("kitchen");
    test.skip(!kitchen, missingAccount("kitchen"));
    await page.goto("/staff/sign-in");
    await page.getByLabel("Email").fill(kitchen!.email);
    await fillSecret(page.getByLabel("Password"), "definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/sign-in/);
    await expect(page.getByLabel("Email")).toHaveValue(kitchen!.email); // kept for the retry
  });

  test("kitchen signs in and lands on the kitchen display", async ({ page }) => {
    const kitchen = account("kitchen");
    test.skip(!kitchen, missingAccount("kitchen"));
    await signIn(page, kitchen!);
    await expect(page).toHaveURL(/\/staff\/kitchen$/);
    await expect(page.getByRole("heading", { name: "Kitchen Display" })).toBeVisible();
  });

  test("kitchen cannot open the owner's Tables & QR page", async ({ page }) => {
    const kitchen = account("kitchen");
    test.skip(!kitchen, missingAccount("kitchen"));
    await signIn(page, kitchen!, "/staff/settings/qr");
    await expect(page).toHaveURL(/\/staff\/settings\/qr$/);
    await expect(page.getByRole("heading", { name: "Settings are for the owner" })).toBeVisible();
    await expect(page.locator("figure")).toHaveCount(0); // no QR cards rendered
  });

  test("owner can open the Tables & QR page", async ({ page }) => {
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await signIn(page, owner!, "/staff/settings/qr");
    await expect(page.getByRole("heading", { name: "Tables & QR" })).toBeVisible();
    await expect(page.locator("figure")).toHaveCount(12);
  });
});
