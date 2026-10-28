import { expect, test, type Browser, type Page } from "@playwright/test";
import { account, missingAccount, signIn, type Role } from "./helpers";

// LEARNING-99 end to end: staff open a table → guest joins with the PIN and orders → staff close.
// Every actor gets its own browser context (= its own device). Screenshots for the prototype
// comparison go to test-results/screens (gitignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });

async function staff(browser: Browser, role: Role) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await signIn(page, account(role)!);
  return page;
}

const panelOf = (page: Page, code: string) => page.getByRole("region", { name: `Table ${code} details` });

/** Opens the table on S1 (if needed) and returns its PIN, read from the screen like a cashier would. */
async function openTable(page: Page, code: string) {
  await page.goto(`/staff/tables?table=${code}`);
  const panel = panelOf(page, code);
  const open = panel.getByRole("button", { name: "Open session" });
  if (await open.isVisible()) await open.click();
  await panel.getByRole("button", { name: `Show the PIN of Table ${code}` }).click();
  return (await panel.getByText(/^\d{4}$/).innerText()).trim();
}

async function guest(browser: Browser) {
  return (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
}

async function join(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/t/${code}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("PIN digit 1 of 4").fill(pin); // the whole code into the first box, like autofill
  await page.getByRole("button", { name: "Join table & view menu" }).click();
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible();
}

async function orderIcedTea(page: Page, code: string) {
  await page.getByRole("link", { name: /Trà đá chanh/ }).first().click();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.waitForURL(`**/t/${code}`);
  await page.goto(`/t/${code}/cart`);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(`**/t/${code}/order/**`);
}

/** Owner closes the table whatever its state: already closed, open and settled, or owing (force). */
async function forceClose(page: Page, code: string, reason: string) {
  await page.goto(`/staff/tables?table=${code}`);
  const panel = panelOf(page, code);
  await expect(panel).toBeVisible(); // isVisible() below doesn't wait for the page
  if (await panel.getByRole("button", { name: "Open session" }).isVisible()) return;
  const reasonBox = panel.getByPlaceholder("e.g. Guests left without paying");
  if (await reasonBox.isVisible()) {
    await reasonBox.fill(reason);
    await panel.getByRole("button", { name: "Force close" }).click();
  } else {
    await panel.getByRole("button", { name: "Close session" }).click();
  }
  await expect(panel.getByRole("button", { name: "Open session" })).toBeVisible();
}

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
});
