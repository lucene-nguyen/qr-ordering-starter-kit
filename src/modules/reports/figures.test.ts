import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, bucketLabel, byCategory, localToday, percentChange, periods, perTable, rangeOf, totals } from "./figures.ts";

test("today is the restaurant's day: 23:30 UTC is already the next day in Asia/Ho_Chi_Minh", () => {
  assert.equal(localToday(new Date("2026-10-29T16:59:00Z"), "Asia/Ho_Chi_Minh"), "2026-10-29");
  assert.equal(localToday(new Date("2026-10-29T17:00:00Z"), "Asia/Ho_Chi_Minh"), "2026-10-30");
});

test("periods: the range ends today and the previous one has the same length", () => {
  assert.deepEqual(periods(rangeOf("7d"), "2026-10-29"), {
    from: "2026-10-23", to: "2026-10-29", prevFrom: "2026-10-16", prevTo: "2026-10-22",
  });
  assert.deepEqual(periods(rangeOf("today"), "2026-03-01"), {
    from: "2026-03-01", to: "2026-03-01", prevFrom: "2026-02-28", prevTo: "2026-02-28",
  });
  assert.equal(periods(rangeOf("30d"), "2024-03-01").from, "2024-02-01"); // leap year: 29 Feb counts
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("unknown query values fall back to 7 days", () => {
  assert.equal(rangeOf("1y").key, "7d");
  assert.equal(rangeOf(undefined).key, "7d");
});

test("totals add up every bucket; avg per table is 0 without tables", () => {
  const t = totals([
    { bucket: "2020-03-10", revenue: 165000, orders: 2, sessions: 2, unpaid: 0 },
    { bucket: "2020-03-11", revenue: 143000, orders: 3, sessions: 2, unpaid: 117000 },
  ]);
  assert.deepEqual(t, { revenue: 308000, orders: 5, sessions: 4, unpaid: 117000 });
  assert.equal(perTable(t.revenue, t.sessions), 77000);
  assert.equal(perTable(100000, 3), 33333); // whole đồng
  assert.equal(perTable(0, 0), 0);
});

test("percent change; nothing before means no comparison", () => {
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(90, 100), -10);
  assert.equal(percentChange(50, 0), null);
});

test("bucket labels: day, week of the Monday, month", () => {
  assert.equal(bucketLabel("2020-03-10", "day"), "10 Mar");
  assert.equal(bucketLabel("2020-03-09", "week"), "Week of 9 Mar");
  assert.equal(bucketLabel("2020-03-01", "month"), "Mar 2020");
});

test("categories add up their dishes, highest revenue first", () => {
  const rows = byCategory([
    { menu_item_id: "a", name: "Phở bò tái", category: "Noodles", qty: 5, revenue: 265000 },
    { menu_item_id: "b", name: "Trà đá chanh", category: "Drinks", qty: 9, revenue: 135000 },
    { menu_item_id: "c", name: "Bún chả Hà Nội", category: "Noodles", qty: 2, revenue: 160000 },
  ]);
  assert.deepEqual(rows, [{ name: "Noodles", revenue: 425000 }, { name: "Drinks", revenue: 135000 }]);
});
