import { expect, test } from "@playwright/test";
import { account, missingAccount, signIn, signOutIfSignedIn } from "./helpers";

// O2 / O2b · Reports (LEARNING-100). That a closed table really adds to today's revenue is
// checked end to end in table-flow.spec.ts (f).
test.describe("O2 · reports", () => {
  test.afterEach(async ({ page }) => signOutIfSignedIn(page));

  for (const role of ["cashier", "kitchen"] as const) {
    test(`a ${role} sees O2b, not the figures`, async ({ page }) => {
      const staff = account(role);
      test.skip(!staff, missingAccount(role));
      await signIn(page, staff!, "/staff/reports");
      await expect(page.getByRole("heading", { name: "Reports are for the owner" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Revenue", exact: true })).toHaveCount(0);
      if (role === "cashier") await page.screenshot({ path: "test-results/screens/O2b-reports-no-access.png", fullPage: true });
    });
  }

  test("the owner sees revenue, dishes and hours, and can change the period and grouping", async ({ page }) => {
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await signIn(page, owner!, "/staff/reports");
    await expect(page.getByRole("heading", { name: "Revenue", exact: true })).toBeVisible();
    await expect(page.getByText("Last 7 days · Asia/Ho_Chi_Minh")).toBeVisible();
    for (const name of ["Revenue", "Orders", "Avg. per table", "Today so far", "Best sellers", "Revenue by category", "Peak hours"]) {
      await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("list", { name: "Revenue by day" }).getByRole("listitem")).toHaveCount(7); // one bar per day, gaps as 0
    await page.screenshot({ path: "test-results/screens/O2-reports.png", fullPage: true });

    await page.getByRole("navigation", { name: "Period" }).getByRole("link", { name: "30 days" }).click();
    await expect(page.getByText("Last 30 days · Asia/Ho_Chi_Minh")).toBeVisible();
    await expect(page.getByRole("list", { name: "Revenue by day" }).getByRole("listitem")).toHaveCount(30);

    await page.getByRole("navigation", { name: "Group by" }).getByRole("link", { name: "Week" }).click();
    await expect(page.getByRole("heading", { name: "Revenue by week" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Revenue by week" }).getByRole("listitem").first()).toContainText("Week of");
    await expect(page).toHaveURL(/range=30d&grain=week/);
  });
});
