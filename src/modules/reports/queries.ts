import "server-only";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { type Grain, periods, type Range, totals } from "./figures";

/**
 * O2 · everything the Reports page shows, read AS the signed-in staff member: the report_*
 * functions refuse anyone but the owner (NOT_ALLOWED), so callers check the role first.
 * The previous period is read the same way to compare with; "Today so far" is today alone.
 */
export async function getReport(range: Range, grain: Grain, today: string) {
  const p = periods(range, today);
  const db = await createAuthClient();
  const [current, previous, todayOnly, items, hours] = await Promise.all([
    db.rpc("report_revenue", { p_from: p.from, p_to: p.to, p_grain: grain }),
    db.rpc("report_revenue", { p_from: p.prevFrom, p_to: p.prevTo, p_grain: "month" }), // totals only
    db.rpc("report_revenue", { p_from: today, p_to: today, p_grain: "day" }),
    db.rpc("report_items", { p_from: p.from, p_to: p.to }),
    db.rpc("report_hours", { p_from: p.from, p_to: p.to }),
  ]);
  for (const r of [current, previous, todayOnly, items, hours]) if (r.error) throw r.error;

  return {
    buckets: current.data!,
    now: totals(current.data!),
    before: totals(previous.data!),
    today: totals(todayOnly.data!).revenue,
    items: items.data!,
    hours: hours.data!,
  };
}
