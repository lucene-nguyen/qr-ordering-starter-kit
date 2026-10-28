import assert from "node:assert/strict";
import { test } from "node:test";
import { splitEvenly } from "./split.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("250.000 between 3 → 83.000 / 83.000 / 84.000", () => {
  assert.deepEqual(splitEvenly(250000, 3), [83000, 83000, 84000]);
});

test("shares are rounded down to 1.000đ, the last person pays the rest", () => {
  assert.deepEqual(splitEvenly(100000, 3), [33000, 33000, 34000]);
  assert.deepEqual(splitEvenly(87500, 2), [43000, 44500]); // a bill not on a 1.000đ boundary
  assert.deepEqual(splitEvenly(240000, 8), Array(8).fill(30000)); // divides evenly: no remainder
  assert.deepEqual(splitEvenly(65000, 1), [65000]);
});

test("for every total and 2–8 people the shares add up to the bill exactly", () => {
  for (let total = 1000; total <= 400000; total += 500) {
    for (let people = 2; people <= 8 && people * 1000 <= total; people++) {
      const shares = splitEvenly(total, people);
      assert.equal(sum(shares), total, `${total} / ${people}`);
      assert.equal(shares.length, people);
      const [first, last] = [shares[0], shares.at(-1)!];
      assert.ok(shares.slice(0, -1).every((s) => s === first && s % 1000 === 0 && s >= 1000), `${total} / ${people}: equal round shares`);
      assert.ok(last >= first, `${total} / ${people}: the last person carries the remainder`);
    }
  }
});

test("paying one share at a time, as the database does, also adds up to the bill", () => {
  for (const total of [250000, 11000, 87500, 99999, 123456, 400000]) {
    for (let people = 2; people <= 8 && people * 1000 <= total; people++) {
      let open = total;
      const paid: number[] = [];
      for (let unpaid = people; unpaid >= 1; unpaid--) {
        const share = splitEvenly(open, unpaid)[0]!; // what request_payment charges this guest
        paid.push(share);
        open -= share;
      }
      assert.equal(sum(paid), total, `${total} / ${people}: ${paid.join(" + ")}`);
      assert.equal(open, 0);
    }
  }
  // the order matters: one at a time 11.000 / 3 is 3.000 + 4.000 + 4.000
  let open = 11000;
  const paid = [3, 2, 1].map((unpaid) => {
    const share = splitEvenly(open, unpaid)[0]!;
    open -= share;
    return share;
  });
  assert.deepEqual(paid, [3000, 4000, 4000]);
});

test("rejects amounts and head counts that cannot be split", () => {
  assert.throws(() => splitEvenly(0, 2), RangeError);
  assert.throws(() => splitEvenly(-5000, 2), RangeError);
  assert.throws(() => splitEvenly(1500.5, 2), RangeError);
  assert.throws(() => splitEvenly(10000, 0), RangeError);
  assert.throws(() => splitEvenly(10000, 2.5), RangeError);
  assert.throws(() => splitEvenly(2500, 3), RangeError); // a share would be below 1.000đ
});
