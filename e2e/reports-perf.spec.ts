import { expect, test } from "@playwright/test";
import { account, missingAccount, signIn } from "./helpers";

// O2 load time (AC "< 2 s with a few thousand orders"). Not part of the normal run: needs the dev
// history from supabase/dev/seed-reports.sql. Run with `E2E_PERF=1 npx playwright test reports-perf`.
// Each case loads 4 times; the first (cold) is dropped and the median of the other 3 is reported.
test.describe("O2 · load time", () => {
  test.skip(!process.env.E2E_PERF, "set E2E_PERF=1 to measure");

  test("7 / 30 days × day / week / month stay under 2 s", async ({ page }) => {
    test.setTimeout(180_000);
    const owner = account("owner");
    test.skip(!owner, missingAccount("owner"));
    await signIn(page, owner!, "/staff/reports");

    const results: string[] = [];
    for (const range of ["7d", "30d"]) {
      for (const grain of ["day", "week", "month"]) {
        const times: number[] = [];
        for (let i = 0; i < 4; i++) {
          const start = Date.now();
          await page.goto(`/staff/reports?range=${range}&grain=${grain}`);
          await expect(page.getByRole("list", { name: `Revenue by ${grain}` })).toBeVisible();
          times.push(Date.now() - start);
        }
        const median = [...times.slice(1)].sort((a, b) => a - b)[1];
        results.push(`${range} ${grain}: median ${median} ms (runs ${times.join(" / ")} ms, first dropped)`);
        expect(median).toBeLessThan(2000);
      }
    }
    console.log(`O2 load times\n${results.join("\n")}`);
  });
});
