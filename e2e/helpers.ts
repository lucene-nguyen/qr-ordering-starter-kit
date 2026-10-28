import type { Locator, Page } from "@playwright/test";
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
