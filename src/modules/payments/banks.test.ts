import assert from "node:assert/strict";
import { test } from "node:test";
import { accountHolder, bankName, BANKS } from "./banks.ts";

test("account holder names become upper case without marks", () => {
  assert.equal(accountHolder("  Phở Mây   Kitchen "), "PHO MAY KITCHEN");
  assert.equal(accountHolder("Đặng Thị Hoa"), "DANG THI HOA");
});

test("every BIN is 6 digits and listed once; unknown BINs have no name", () => {
  assert.ok(BANKS.every((b) => /^[0-9]{6}$/.test(b.bin)));
  assert.equal(new Set(BANKS.map((b) => b.bin)).size, BANKS.length);
  assert.equal(bankName("970436"), "Vietcombank");
  assert.equal(bankName("000000"), null);
});
