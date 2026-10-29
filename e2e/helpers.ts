import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertDevDatabase } from "./guard";

/**
 * Runs `fn` while the DEV database has no restaurant_settings row (no bank details yet), then puts
 * the row back exactly as it was – also when `fn` fails. Uses the secret key from .env.local.
 */
export async function withoutBankDetails(fn: () => Promise<void>) {
  assertDevDatabase();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data: row, error } = await db.from("restaurant_settings").select("*").maybeSingle();
  if (error) throw new Error(`Reading restaurant_settings failed: ${error.message}`);
  const removed = await db.from("restaurant_settings").delete().eq("id", 1);
  if (removed.error) throw new Error(`Removing restaurant_settings failed: ${removed.error.message}`);
  try {
    await fn();
  } finally {
    if (row) {
      const restored = await db.from("restaurant_settings").insert(row);
      if (restored.error) throw new Error(`Restoring restaurant_settings failed: ${restored.error.message}`);
    }
  }
}

export type Role = "owner" | "cashier" | "kitchen";
export type Account = { email: string; password: string };

/** Test account for a role from .env.test.local (see .env.test.example), or null if not set. */
export function account(role: Role): Account | null {
  const key = role.toUpperCase();
  const email = process.env[`E2E_${key}_EMAIL`];
  const password = process.env[`E2E_${key}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export const missingAccount = (role: Role) =>
  `Set E2E_${role.toUpperCase()}_EMAIL / _PASSWORD in .env.test.local to run this test.`;

/**
 * Types a secret into a field without it ever showing up in Playwright output: traces are off in
 * the config, and a failure here is rethrown without the value (fill() errors can echo it).
 */
export async function fillSecret(field: Locator, value: string) {
  try {
    await field.evaluate((el, v) => {
      (el as HTMLInputElement).value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  } catch {
    throw new Error("Could not fill the secret field (value hidden).");
  }
}

/** Signs in through the real S0 form and waits until the app has moved on from sign-in. */
export async function signIn(page: Page, acc: Account, next?: string) {
  await page.goto(next ? `/staff/sign-in?next=${encodeURIComponent(next)}` : "/staff/sign-in");
  await page.getByLabel("Email").fill(acc.email);
  await fillSecret(page.getByLabel("Password"), acc.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Without this, the next goto() can cancel the sign-in request before its cookie is set.
  await page.waitForURL((url) => !url.pathname.startsWith("/staff/sign-in"));
}

/** Signs out this browser only (scope "local"), so test runs don't pile up sessions. */
export async function signOutIfSignedIn(page: Page) {
  const startShift = page.getByRole("button", { name: "Start shift" });
  if (await startShift.isVisible().catch(() => false)) await startShift.click();
  const signOut = page.getByRole("button", { name: "Sign out" });
  if (await signOut.first().isVisible().catch(() => false)) {
    await signOut.first().click();
    await page.waitForURL("**/staff/sign-in");
  }
}

// Table flow: each actor is its own browser context (= its own device).

export async function staff(browser: Browser, role: Role) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await signIn(page, account(role)!);
  return page;
}

export const panelOf = (page: Page, code: string) => page.getByRole("region", { name: `Table ${code} details` });

/** Opens the table on S1 (if needed) and returns its PIN, read from the screen like a cashier would. */
export async function openTable(page: Page, code: string) {
  await page.goto(`/staff/tables?table=${code}`);
  const panel = panelOf(page, code);
  const open = panel.getByRole("button", { name: "Open session" });
  if (await open.isVisible()) await open.click();
  await panel.getByRole("button", { name: `Show the PIN of Table ${code}` }).click();
  return (await panel.getByText(/^\d{4}$/).innerText()).trim();
}

export async function guest(browser: Browser) {
  return (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
}

export async function join(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/t/${code}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("PIN digit 1 of 4").fill(pin); // the whole code into the first box, like autofill
  await page.getByRole("button", { name: "Join table & view menu" }).click();
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible();
}

export async function orderIcedTea(page: Page, code: string) {
  await page.getByRole("link", { name: /Trà đá chanh/ }).first().click();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.waitForURL(`**/t/${code}`);
  await page.goto(`/t/${code}/cart`);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(`**/t/${code}/order/**`);
}

/** Adds `qty` of a dish in its default (first) size to the shared cart. */
export async function addDish(page: Page, code: string, dish: string, qty: number) {
  await page.getByRole("link", { name: new RegExp(dish) }).first().click();
  for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.waitForURL(`**/t/${code}`);
}

export async function placeOrder(page: Page, code: string) {
  await page.goto(`/t/${code}/cart`);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(`**/t/${code}/order/**`);
}

/** Owner closes the table whatever its state: already closed, open and settled, or owing (force). */
export async function forceClose(page: Page, code: string, reason: string) {
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
