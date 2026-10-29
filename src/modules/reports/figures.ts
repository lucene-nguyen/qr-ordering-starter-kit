// Pure helpers for O2 · Reports: date ranges in the restaurant's time zone and the figures shown on
// the page. Dates are local calendar days as "YYYY-MM-DD", the form report_* take.

/** Must match the time zone written in the report_* SQL functions (ADR 0004). */
export const REPORT_TIMEZONE = "Asia/Ho_Chi_Minh";

export const RANGES = [
  { key: "today", label: "Today", days: 1, title: "Today", previous: "yesterday" },
  { key: "7d", label: "7 days", days: 7, title: "Last 7 days", previous: "previous 7 days" },
  { key: "30d", label: "30 days", days: 30, title: "Last 30 days", previous: "previous 30 days" },
] as const;
export type Range = (typeof RANGES)[number];

export const GRAINS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
] as const;
export type Grain = (typeof GRAINS)[number]["key"];

export const rangeOf = (key: unknown): Range => RANGES.find((r) => r.key === key) ?? RANGES[1];
export const grainOf = (key: unknown): Grain => GRAINS.find((g) => g.key === key)?.key ?? "day";

const DAY_MS = 86_400_000;
/** "2020-03-10" moved by n calendar days. */
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);

/** Today's calendar date in `timeZone` (the restaurant's day, not the server's). */
export function localToday(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The chosen period ending today, and the period of the same length right before it. */
export function periods(range: Range, today: string) {
  const from = addDays(today, -(range.days - 1));
  return { from, to: today, prevFrom: addDays(from, -range.days), prevTo: addDays(from, -1) };
}

export type RevenueRow = { bucket: string; revenue: number; orders: number; sessions: number; unpaid: number };

export function totals(rows: RevenueRow[]) {
  return rows.reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, orders: t.orders + r.orders, sessions: t.sessions + r.sessions, unpaid: t.unpaid + r.unpaid }),
    { revenue: 0, orders: 0, sessions: 0, unpaid: 0 },
  );
}

/** Revenue per closed table, in whole đồng; 0 when no table closed. */
export const perTable = (revenue: number, sessions: number) => (sessions === 0 ? 0 : Math.round(revenue / sessions));

/** Change in percent against the previous period; null when there is nothing to compare with. */
export const percentChange = (now: number, before: number) => (before === 0 ? null : ((now - before) / before) * 100);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Chart label of a report_revenue bucket. A week or month may start before the chosen range. */
export function bucketLabel(bucket: string, grain: Grain) {
  const d = new Date(`${bucket}T00:00:00Z`);
  const dayMonth = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (grain === "month") return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return grain === "week" ? `Week of ${dayMonth}` : dayMonth;
}

/** Axis label that fits a bar on a 390 px phone: "10/3" (day, week start) or "Mar" (month). */
export function shortBucketLabel(bucket: string, grain: Grain) {
  const d = new Date(`${bucket}T00:00:00Z`);
  return grain === "month" ? MONTHS[d.getUTCMonth()] : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export type ItemRow = { menu_item_id: string; name: string; category: string; qty: number; revenue: number };

/** Dish revenue added up per category, highest first. */
export function byCategory(items: ItemRow[]) {
  const sums = new Map<string, number>();
  for (const i of items) sums.set(i.category, (sums.get(i.category) ?? 0) + i.revenue);
  return [...sums].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
}
