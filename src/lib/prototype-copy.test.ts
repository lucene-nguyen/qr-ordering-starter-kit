import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The prototype is served at /prototype from a copy in public/. The two must never drift apart.
test("public/prototype/index.html is an exact copy of docs/prototype/tabletap-prototype.html", () => {
  const source = readFileSync("docs/prototype/tabletap-prototype.html");
  const served = readFileSync("public/prototype/index.html");
  assert.ok(source.equals(served), "The copies differ – run `npm run prototype:sync`.");
});
