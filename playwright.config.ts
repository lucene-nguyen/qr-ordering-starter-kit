import { defineConfig, devices } from "@playwright/test";
import { assertDevDatabase } from "./e2e/guard";

// Same env the app uses (.env.local → dev project) plus test accounts (.env.test.local, gitignored).
// Values already set in the shell win, exactly as they would for `next dev`.
for (const file of [".env.local", ".env.test.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {} // a missing file is reported by the guard / skipped tests
}
assertDevDatabase(); // before the web server even starts

// 3000 by default; set E2E_PORT when your own `npm run dev` is already using it.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // tests share one dev database
  reporter: [["list"]],
  use: {
    baseURL,
    // Secrets must never land in artifacts: no traces or videos; screenshots only on failure
    // (password fields render as dots).
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build: closest to Vercel, and it can run next to your own `next dev`
    // (Next allows only one dev server per project folder).
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false, // never test against a server started with other settings
    timeout: 240_000,
  },
});
