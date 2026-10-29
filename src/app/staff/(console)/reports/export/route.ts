import type { NextRequest } from "next/server";
import { toCsv } from "@/modules/reports/csv";
import { grainOf, localToday, periods, perTable, rangeOf, REPORT_TIMEZONE } from "@/modules/reports/figures";
import { getReport } from "@/modules/reports/queries";
import { allowed, CAN, getStaff } from "@/modules/staff/queries";

// O2 · "Export CSV": the same figures as the page, for the same period and grouping.
// ?kind=revenue (default) → one row per day/week/month; ?kind=dishes → one row per dish.
// Owner only; the report_* functions check the role again in the database.
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff || !allowed(staff, CAN.viewReports)) return new Response("Reports are for the owner.", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const range = rangeOf(sp.get("range"));
  const grain = grainOf(sp.get("grain"));
  const dishes = sp.get("kind") === "dishes";
  const today = localToday(new Date(), REPORT_TIMEZONE);
  const { from, to } = periods(range, today);
  const r = await getReport(range, grain, today);

  const csv = dishes
    ? toCsv([
        ["Dish", "Category", "Sold", "Revenue (VND)"],
        ...r.items.map((i) => [i.name, i.category, i.qty, i.revenue]),
      ])
    : toCsv([
        [`${grain === "day" ? "Day" : grain === "week" ? "Week starting" : "Month starting"}`, "Revenue (VND)", "Orders", "Tables closed", "Avg. per table (VND)", "Unpaid closed by owner (VND)"],
        ...r.buckets.map((b) => [b.bucket, b.revenue, b.orders, b.sessions, perTable(b.revenue, b.sessions), b.unpaid]),
      ]);
  const name = dishes ? `tabletap-dishes_${from}_${to}.csv` : `tabletap-revenue-by-${grain}_${from}_${to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
