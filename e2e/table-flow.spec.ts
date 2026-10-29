import { expect, test, type Page } from "@playwright/test";
import {
  account, addDish, forceClose, guest, join, missingAccount, openTable, orderIcedTea, panelOf, placeOrder, staff, withoutBankDetails,
} from "./helpers";

// LEARNING-99 end to end: staff open a table → guest joins with the PIN and orders → staff close.
// Every actor gets its own browser context (= its own device). Screenshots for the prototype
// comparison go to test-results/screens (gitignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });

test.describe("table session flow", () => {
  test.describe.configure({ timeout: 90_000 }); // three devices and several page loads per test
  test.beforeEach(() => {
    for (const role of ["owner", "cashier"] as const) test.skip(!account(role), missingAccount(role));
  });

  test("(a) PIN join and order → cashier can't close an unpaid table → owner force-closes → guest sees it closed", async ({ browser }) => {
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const lan = await guest(browser);

    // 00b while the table is closed
    await forceClose(owner, "10", "E2E clean start");
    await lan.goto("/t/10");
    await expect(lan.getByRole("heading", { name: "This table isn't open yet" })).toBeVisible();
    await shot(lan, "00b-table-closed");

    const pin = await openTable(cashier, "10");
    await shot(cashier, "S1b-open-session");

    // Join screen, one wrong PIN, then the right one
    await lan.goto("/t/10");
    await expect(lan.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
    await shot(lan, "00-join");
    await lan.getByLabel("PIN digit 1 of 4").fill(pin === "0000" ? "1111" : "0000");
    await lan.getByRole("button", { name: "Join table & view menu" }).click();
    await expect(lan.getByRole("alert").filter({ hasText: /Wrong PIN, \d tries? left/ })).toBeVisible();
    await join(lan, "10", "Lan", pin);
    await orderIcedTea(lan, "10");

    // Cashier: money is owed, so Close is locked and explained
    await cashier.goto("/staff/tables?table=10");
    const cashierPanel = panelOf(cashier, "10");
    await expect(cashierPanel.getByRole("button", { name: "Close session" })).toBeDisabled();
    await expect(cashierPanel).toContainText("Only the owner can close an unpaid table");

    // Owner force-closes with a reason; the guest's open menu moves to 00b by itself
    await lan.goto("/t/10");
    await expect(lan.getByText("Welcome, Lan")).toBeVisible();
    await lan.waitForTimeout(1500); // let the guest's Realtime channel join
    await forceClose(owner, "10", "E2E: guests left without paying");
    await expect(lan.getByRole("heading", { name: "This table isn't open yet" })).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await lan.context().cookies()).some((c) => c.name === "tt_guest")).toBe(false);
  });

  test("(b) S1 updates by itself when a guest orders (no reload)", async ({ browser }) => {
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const minh = await guest(browser);

    await forceClose(owner, "11", "E2E clean start");
    const pin = await openTable(cashier, "11");
    const card = cashier.getByRole("link", { name: /^Table 11/ });
    await expect(card).toContainText("0 guests");
    await cashier.waitForTimeout(1500); // let the staff Realtime channel join

    await join(minh, "11", "Minh", pin);
    await orderIcedTea(minh, "11");

    // Same cashier page, never reloaded
    await expect(card).toContainText("1 guest", { timeout: 10_000 });
    await expect(card).toContainText("15.000đ", { timeout: 10_000 });
    await expect(panelOf(cashier, "11")).toContainText("Minh");
    await shot(cashier, "S1-tables-live");

    await forceClose(owner, "11", "E2E cleanup");
  });

  test("(c) split 3 ways → 83.000đ VietQR → cashier confirms on C2 → the guest sees Paid (no reload)", async ({ browser }) => {
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const lan = await guest(browser);

    await forceClose(owner, "09", "E2E clean start");
    const pin = await openTable(cashier, "09");
    await join(lan, "09", "Lan", pin);
    await addDish(lan, "09", "Phở bò tái", 2); // 2 × 65.000
    await addDish(lan, "09", "Bún chả Hà Nội", 2); // 2 × 60.000 → bill 250.000
    await lan.goto("/t/09/cart");
    await lan.getByRole("button", { name: /Place order/ }).click();
    await lan.waitForURL("**/t/09/order/**");

    // 05 · split equally between 3: 250.000 / 3 → 83.000 (rounded down to 1.000đ)
    await lan.getByRole("link", { name: "Request bill" }).click();
    await lan.getByRole("link", { name: "Split equally" }).click();
    await lan.getByRole("link", { name: "More people" }).click();
    await expect(lan.getByRole("main")).toContainText("Your share (1 of 3)");
    await expect(lan.getByRole("main")).toContainText("83.000đ");
    await lan.getByRole("button", { name: "Show payment QR" }).click();
    await lan.waitForURL(/\/t\/09\/pay\/[0-9a-f-]{36}$/);
    await expect(lan.getByRole("img", { name: "VietQR code for 83.000đ" })).toBeVisible(); // amount from payments.amount
    await expect(lan.getByRole("main")).toContainText(/TBL09 [A-Z]\d+/); // transfer note from payments.reference
    await shot(lan, "05-pay-qr");

    // 05b · waiting for the cashier
    await lan.getByRole("link", { name: "I've completed the transfer" }).click();
    await expect(lan.getByRole("heading", { name: "We haven't received it yet" })).toBeVisible();
    await shot(lan, "05b-pending");
    await lan.waitForTimeout(1500); // let the guest's Realtime channel join

    // C2 · the cashier confirms the transfer
    await cashier.goto("/staff/checkout?table=09");
    const payments = cashier.getByRole("region", { name: "Payments" });
    await expect(payments).toContainText("Lan");
    await expect(payments).toContainText("83.000đ");
    await expect(cashier.getByRole("button", { name: "Close table" })).toBeDisabled(); // 167.000đ still open
    await shot(cashier, "C2-checkout");
    await payments.getByRole("button", { name: "Confirm received" }).click();
    await expect(payments).toContainText("Paid");

    // 06 · same guest page, never reloaded
    await expect(lan.getByRole("heading", { name: "Payment received" })).toBeVisible({ timeout: 10_000 });
    await expect(lan.getByRole("main")).toContainText("83.000đ");
    await shot(lan, "06-paid");

    await forceClose(owner, "09", "E2E cleanup: the other shares were never paid");
  });

  test("(d) Paid in cash while a VietQR request is awaiting asks first, then withdraws it", async ({ browser }) => {
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const lan = await guest(browser);

    await forceClose(owner, "01", "E2E clean start");
    const pin = await openTable(cashier, "01");
    await join(lan, "01", "Lan", pin);
    await addDish(lan, "01", "Phở bò tái", 1);
    await placeOrder(lan, "01");
    await lan.goto("/t/01/pay");
    await lan.getByRole("button", { name: "Show payment QR" }).click();
    await expect(lan.getByRole("img", { name: "VietQR code for 65.000đ" })).toBeVisible();
    await lan.waitForTimeout(1500); // let the guest's Realtime channel join

    await cashier.goto("/staff/checkout?table=01");
    const payments = cashier.getByRole("region", { name: "Payments" });
    await expect(payments).toContainText("Awaiting");
    await payments.getByRole("button", { name: "Paid in cash · 65.000đ" }).click();
    const dialog = cashier.getByRole("dialog", { name: "Record a cash payment?" });
    await expect(dialog).toContainText(
      "Lan's 65.000đ transfer request will be cancelled. Check your bank app first — if it arrived, confirm it instead.",
    );
    await shot(cashier, "C2-cash-confirm");
    await dialog.getByRole("button", { name: "Go back" }).click();
    await expect(dialog).toBeHidden();
    await expect(payments).toContainText("Awaiting"); // nothing changed

    await payments.getByRole("button", { name: "Paid in cash · 65.000đ" }).click();
    await dialog.getByRole("button", { name: "Record cash · 65.000đ" }).click();
    await expect(payments).toContainText("Cash at the counter");
    await expect(payments).toContainText("Settled");
    await expect(payments).not.toContainText("Awaiting"); // the transfer request was withdrawn

    // The guest's QR disappears by itself; closing the table then takes the phone to 00b.
    await expect(lan.getByText("Everything left is already being paid or settled.")).toBeVisible({ timeout: 10_000 });
    await payments.getByRole("button", { name: "Close table" }).click();
    await expect(lan.getByRole("heading", { name: "This table isn't open yet" })).toBeVisible({ timeout: 10_000 });
  });

  test("(e) without bank details the guest is sent to the counter and no transfer request is made", async ({ browser }) => {
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const minh = await guest(browser);

    await forceClose(owner, "02", "E2E clean start");
    const pin = await openTable(cashier, "02");
    await join(minh, "02", "Minh", pin);
    await addDish(minh, "02", "Bún chả Hà Nội", 1);
    await placeOrder(minh, "02");
    await withoutBankDetails(async () => {
      await minh.goto("/t/02/pay");
      await expect(minh.getByRole("heading", { name: "Pay at the counter" })).toBeVisible();
      await expect(minh.getByRole("main")).toContainText("60.000đ");
      await expect(minh.getByRole("button", { name: "Show payment QR" })).toHaveCount(0);
      await expect(minh.getByRole("img", { name: /VietQR code/ })).toHaveCount(0);
      await shot(minh, "05-pay-at-counter");

      // C2 · nothing awaiting, so cash is recorded straight away (no transfer warning)
      await cashier.goto("/staff/checkout?table=02");
      const payments = cashier.getByRole("region", { name: "Payments" });
      await expect(payments).toBeVisible();
      await expect(payments).not.toContainText("Awaiting");
      await payments.getByRole("button", { name: "Paid in cash · 60.000đ" }).click();
      await expect(payments).toContainText("Cash at the counter");
      await expect(cashier.getByRole("dialog", { name: "Record a cash payment?" })).toBeHidden();
    });
    await forceClose(owner, "02", "E2E cleanup");
  });

  test("(f) a table paid in cash and closed adds to today's revenue on O2", async ({ browser }) => {
    // "Today" must not change between the first and last read: skip from 23:50 to 00:05 in Vietnam (UTC+7, no DST).
    const vn = new Date(Date.now() + 7 * 3_600_000);
    const minute = vn.getUTCHours() * 60 + vn.getUTCMinutes();
    test.skip(minute >= 23 * 60 + 50 || minute < 5, "too close to midnight in Asia/Ho_Chi_Minh");
    const cashier = await staff(browser, "cashier");
    const owner = await staff(browser, "owner");
    const an = await guest(browser);
    // The first amount in a KPI card is its value ("Today so far 1.250.000đ Updates when…").
    const kpi = async (name: string) => {
      const text = await owner.getByRole("region", { name, exact: true }).innerText();
      return Number(text.match(/([\d.]+)(đ|\n|$)/)![1].replace(/\./g, ""));
    };

    await forceClose(owner, "12", "E2E clean start");
    await owner.goto("/staff/reports?range=today");
    const before = { revenue: await kpi("Revenue"), today: await kpi("Today so far"), orders: await kpi("Orders") };

    const pin = await openTable(cashier, "12");
    await join(an, "12", "An", pin);
    await orderIcedTea(an, "12"); // 15.000đ

    // An open table is not revenue yet
    await owner.reload();
    expect(await kpi("Revenue")).toBe(before.revenue);

    await cashier.goto("/staff/checkout?table=12");
    const payments = cashier.getByRole("region", { name: "Payments" });
    await payments.getByRole("button", { name: "Paid in cash · 15.000đ" }).click();
    await expect(payments).toContainText("Settled");
    await payments.getByRole("button", { name: "Close table" }).click();
    await expect(cashier.getByRole("heading", { name: "Checkout · Table 12" })).toHaveCount(0);

    await owner.reload();
    expect(await kpi("Revenue")).toBe(before.revenue + 15000);
    expect(await kpi("Today so far")).toBe(before.today + 15000);
    expect(await kpi("Orders")).toBe(before.orders + 1);
    await shot(owner, "O2-reports-today");
  });
});
