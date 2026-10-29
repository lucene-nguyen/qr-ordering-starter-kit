// Exports docs/architecture.drawio → docs/architecture.svg for GitHub (README and architecture.md).
// Usage: node scripts/export-architecture.mjs   (needs draw.io desktop; set DRAWIO to its .exe if not found)
//
// Two fixes on top of draw.io's own export, so the SVG is small and shows its icons as an <img>:
// - drop the PNG fallback draw.io adds after every HTML label (browsers render the label itself);
// - inline the tabler icons as SVG data URIs (an <img> SVG may not load external images).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const candidates = [
  process.env.DRAWIO,
  join(process.env.LOCALAPPDATA ?? "", "Programs", "draw.io", "draw.io.exe"),
  "C:\\Program Files\\draw.io\\draw.io.exe",
  "/Applications/draw.io.app/Contents/MacOS/draw.io",
  "/usr/bin/drawio",
].filter(Boolean);
const drawio = candidates.find((p) => existsSync(p));
if (!drawio) throw new Error("draw.io desktop not found – set DRAWIO to its executable");

const out = "docs/architecture.svg";
execFileSync(drawio, ["-x", "-f", "svg", "-b", "16", "-o", out, "docs/architecture.drawio"], { stdio: "inherit" });

let svg = readFileSync(out, "utf8");
svg = svg.replace(/(<\/foreignObject>)<image [^>]*xlink:href="data:image\/png;base64,[^"]*"[^>]*\/>/g, "$1");

for (const url of new Set(svg.match(/https:\/\/icons\.diagrams\.net\/[^"]+\.svg/g) ?? [])) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = `data:image/svg+xml;base64,${Buffer.from(await res.text()).toString("base64")}`;
  svg = svg.replaceAll(url, data);
}
if (/data:image\/png|icons\.diagrams\.net/.test(svg)) throw new Error("PNG fallbacks or external icons left in the SVG");

writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(0)} KB`);
