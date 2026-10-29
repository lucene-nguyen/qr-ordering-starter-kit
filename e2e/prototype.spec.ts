import { expect, test } from "@playwright/test";

// The clickable prototype is served with the app (public/prototype/index.html via a rewrite) and
// needs no sign-in: proxy.ts only guards /staff.
test.describe("clickable prototype", () => {
  for (const path of ["/prototype", "/prototype/"]) {
    test(`${path} opens without signing in and can be clicked through`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).not.toContain("/staff/sign-in");
      await expect(page.getByRole("navigation", { name: "Jump to screen" })).toBeVisible();

      await page.getByRole("button", { name: "Staff console", exact: true }).click();
      await page.locator('[data-jump="reports"]').click();
      await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();
    });
  }
});
