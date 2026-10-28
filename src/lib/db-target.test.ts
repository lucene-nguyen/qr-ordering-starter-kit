import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseTarget, DEV_REF, PROD_REF } from "./db-target.ts";

const url = (ref: string) => `https://${ref}.supabase.co`;

test("a Preview on the prod database is flagged (writes get blocked)", () => {
  const t = databaseTarget(url(PROD_REF), "preview");
  assert.equal(t.misconfigured, true);
  assert.equal(t.label, "PROD DB");
});

test("normal setups are not flagged", () => {
  assert.equal(databaseTarget(url(PROD_REF), "production").misconfigured, false); // prod on prod
  assert.equal(databaseTarget(url(DEV_REF), "preview").misconfigured, false); // preview on dev
  assert.equal(databaseTarget(url(DEV_REF), undefined).misconfigured, false); // local on dev
});

test("label and ref come from the public URL; no URL is 'unknown', never a crash", () => {
  assert.deepEqual(databaseTarget(url(DEV_REF), undefined), {
    ref: DEV_REF,
    deployment: "local",
    label: "DEV DB",
    misconfigured: false,
  });
  assert.equal(databaseTarget(undefined, "preview").ref, "unknown");
  assert.equal(databaseTarget("https://evil.example/?x=sxwcsxyalzblvkhtlola.supabase.co", "preview").ref, "unknown");
});
