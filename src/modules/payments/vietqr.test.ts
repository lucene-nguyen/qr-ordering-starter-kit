import assert from "node:assert/strict";
import { test } from "node:test";
import { crc16, transferNote, vietQrPayload } from "./vietqr.ts";

/** Reads EMVCo TLV fields back, so the tests check structure instead of a copied string. */
function parse(payload: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (let i = 0; i < payload.length; ) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    fields[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return fields;
}

const input = { bin: "970436", accountNo: "1234567890", amount: 250000, note: "TBL05 A0421" };

test("CRC16/CCITT-FALSE standard check value: '123456789' → 29B1", () => {
  assert.equal(crc16("123456789"), "29B1");
  assert.equal(crc16(""), "FFFF");
});

test("payload carries bank, account, amount, currency, country and transfer note", () => {
  const f = parse(vietQrPayload(input));
  assert.equal(f["00"], "01");
  assert.equal(f["01"], "12");
  const account = parse(f["38"]!);
  assert.equal(account["00"], "A000000727");
  assert.deepEqual(parse(account["01"]!), { "00": "970436", "01": "1234567890" });
  assert.equal(account["02"], "QRIBFTTA");
  assert.equal(f["53"], "704");
  assert.equal(f["54"], "250000");
  assert.equal(f["58"], "VN");
  assert.equal(parse(f["62"]!)["08"], "TBL05 A0421");
});

test("payload ends with a CRC over everything before it", () => {
  const payload = vietQrPayload(input);
  assert.match(payload, /6304[0-9A-F]{4}$/);
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
  // a single changed digit (amount 250000 → 250001) changes the CRC
  assert.notEqual(vietQrPayload({ ...input, amount: 250001 }).slice(-4), payload.slice(-4));
});

test("transfer note becomes plain upper-case ASCII, max 25 characters", () => {
  assert.equal(transferNote("Tbl05 Phở bò"), "TBL05 PHO BO");
  assert.equal(transferNote("  bàn   đôi #7 "), "BAN DOI 7");
  assert.equal(transferNote("x".repeat(40)).length, 25);
  assert.equal(parse(parse(vietQrPayload({ ...input, note: "Đơn số A-0421" }))["62"]!)["08"], "DON SO A0421");
});

test("rejects bad bank ids, account numbers and amounts", () => {
  assert.throws(() => vietQrPayload({ ...input, bin: "97043" }), RangeError);
  assert.throws(() => vietQrPayload({ ...input, accountNo: "12-34" }), RangeError);
  for (const amount of [0, -1000, 1500.5, Number.NaN]) {
    assert.throws(() => vietQrPayload({ ...input, amount }), RangeError, `amount ${amount}`);
  }
});
