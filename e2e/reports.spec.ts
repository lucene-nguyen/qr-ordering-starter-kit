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

    // Switching the grouping keeps the scroll position and the focus on the link (no jump to the top)
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.getByRole("region", { name: "Revenue chart" }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const week = page.getByRole("navigation", { name: "Group by" }).getByRole("link", { name: "Week" });
    await week.click();
    await expect(page.getByRole("heading", { name: "Revenue by week" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Revenue by week" }).getByRole("listitem").first()).toContainText("Week of");
    await expect(page).toHaveURL(/range=30d&grain=week/);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(week).toBeFocused();
    await expect(week).toHaveAttribute("aria-current", "page");
  });

  test("the owner exports revenue and dishes as CSV that Excel and Sheets read", async ({ page }) => {
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await signIn(page, owner!, "/staff/reports?range=30d&grain=day");
    const revenueText = await page.getByRole("region", { name: "Revenue", exact: true }).innerText();
    const revenue = Number(revenueText.match(/([\d.]+)đ/)![1].replace(/\./g, ""));

    const read = async (link: ReturnType<typeof page.getByRole>) => {
      const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
      const chunks: Buffer[] = [];
      for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
      return { name: download.suggestedFilename(), text: Buffer.concat(chunks).toString("utf8") };
    };

    const byDay = await read(page.getByRole("link", { name: "Export CSV", exact: true }));
    expect(byDay.name).toMatch(/^tabletap-revenue-by-day_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(byDay.text.startsWith("﻿Day,Revenue (VND),Orders,Tables closed,Avg. per table (VND),Unpaid closed by owner (VND)\r\n")).toBe(true);
    const rows = byDay.text.slice(1).trimEnd().split("\r\n").slice(1).map((line) => line.split(","));
    expect(rows).toHaveLength(30); // one line per day, days without sales as 0
    expect(rows.reduce((sum, r) => sum + Number(r[1]), 0)).toBe(revenue); // the file adds up to the page

    const dishes = await read(page.getByRole("link", { name: "Export all dishes as CSV" }));
    expect(dishes.text.startsWith("﻿Dish,Category,Sold,Revenue (VND)\r\n")).toBe(true);
    expect(dishes.text).toContain("Phở bò tái"); // UTF-8 survives
  });

  test("O2 fits a 390 px phone without sideways scrolling", async ({ page }) => {
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, owner!, "/staff/reports");
    await expect(page.getByRole("region", { name: "Best sellers" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Every console link is on screen at once: none hidden in a sideways-scrolling strip
    const nav = page.getByRole("navigation", { name: "Staff console" });
    expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const name of ["Tables", "Kitchen", "Checkout", "Reports", "Settings"]) {
      const box = (await nav.getByRole("link", { name }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: "test-results/screens/O2-reports-390.png", fullPage: true });
  });

  test("a cashier cannot download the CSV either", async ({ page }) => {
    const cashier = account("cashier");
    test.skip(!cashier, missingAccount("cashier"));
    await signIn(page, cashier!, "/staff/tables");
    const res = await page.request.get("/staff/reports/export?range=7d");
    expect(res.status()).toBe(403);
  });
});
