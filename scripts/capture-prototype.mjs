// Screenshots of every prototype screen for docs/prototype/README.md (the gallery).
// Usage: node scripts/capture-prototype.mjs → docs/prototype/screens/<code>-<screen>.png
// Guest screens are taken on a 390 px phone, staff screens on a 1280 px desktop, using the
// prototype's own "Jump to screen" buttons, so the list follows GUEST_SCREENS / STAFF_SCREENS.
import { chromium } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const url = pathToFileURL(resolve("docs/prototype/tabletap-prototype.html")).href;
const outDir = "docs/prototype/screens";
const MAX_BYTES = 300 * 1024;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];
for (const mode of [
  { name: "guest", button: "Guest app", list: "GUEST_SCREENS", frame: ".device", viewport: { width: 390, height: 844 } },
  { name: "staff", button: "Staff console", list: "STAFF_SCREENS", frame: ".desk", viewport: { width: 1280, height: 800 } },
]) {
  const page = await browser.newPage({ viewport: mode.viewport });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: mode.button, exact: true }).click();
  const screens = await page.evaluate((list) => globalThis.eval(list), mode.list);
  for (const [key, code] of screens) {
    await page.locator(`[data-jump="${key}"]`).click();
    await page.waitForTimeout(150); // let the prototype finish drawing its QR codes
    const file = `${outDir}/${code}-${key}.png`;
    await page.locator(mode.frame).screenshot({ path: file, animations: "disabled" });
    results.push({ file, kb: Math.round(statSync(file).size / 1024) });
  }
  await page.close();
}
await browser.close();

for (const r of results) console.log(`${r.kb.toString().padStart(4)} KB  ${r.file}`);
const big = results.filter((r) => r.kb * 1024 > MAX_BYTES);
if (big.length) throw new Error(`over 300 KB: ${big.map((r) => r.file).join(", ")}`);
