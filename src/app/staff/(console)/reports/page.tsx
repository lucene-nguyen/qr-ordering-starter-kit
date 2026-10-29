import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { BarChart } from "@/modules/reports/components/bar-chart";
import {
  bucketLabel, byCategory, GRAINS, grainOf, localToday, percentChange, perTable, RANGES, rangeOf, REPORT_TIMEZONE, shortBucketLabel,
} from "@/modules/reports/figures";
import { getReport } from "@/modules/reports/queries";
import { NoAccess } from "@/modules/staff/components/no-access";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Reports · TableTap staff" };

type Props = { searchParams: Promise<{ range?: string | string[]; grain?: string | string[] }> };

const segment = "rounded-sm px-3 py-1.5 font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand";
const secondary =
  "flex h-[42px] items-center rounded-md border border-border px-4 font-semibold whitespace-nowrap hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand";
const card = "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-5";
const million = (v: number) => (v / 1_000_000).toFixed(2);
const percent = (c: number) => `${c >= 0 ? "+" : "−"}${Math.abs(c).toFixed(1)}%`;

type Trend = "up" | "down" | undefined;
const trendOf = (diff: number): Trend => (diff > 0 ? "up" : diff < 0 ? "down" : undefined);

function Kpi({ label, value, note, trend }: { label: string; value: string; note: string; trend?: Trend }) {
  return (
    <section aria-label={label} className={card}>
      <span className="text-caption text-muted">{label}</span>
      <span className="text-display tabular-nums">{value}</span>
      <span className={`text-caption flex items-center gap-1 ${trend === "up" ? "text-success" : trend === "down" ? "text-brand-strong" : "text-muted"}`}>
        {trend === "up" && <Icon name="trend" size={14} />}
        {note}
      </span>
    </section>
  );
}

// O2 · Revenue reports, owner only (O2b for everyone else). Revenue = confirmed payments of tables
// closed in the period, on their closing day in Asia/Ho_Chi_Minh (ADR 0004).
export default async function ReportsPage({ searchParams }: Props) {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.viewReports)) {
    return (
      <NoAccess
        title="Reports are for the owner"
        description="Revenue and sales figures are only visible to the owner account. Ask the owner if you need a number."
      />
    );
  }
  const sp = await searchParams;
  const range = rangeOf(sp.range);
  const grain = grainOf(sp.grain);
  const r = await getReport(range, grain, localToday(new Date(), REPORT_TIMEZONE));
  // Period and grouping links stay where the owner is reading (no scroll to top, no history entry per
  // click). With no loading.tsx, the old figures stay on screen until the new ones arrive.
  const href = (rangeKey: string, grainKey: string) => `/staff/reports?range=${rangeKey}&grain=${grainKey}`;

  const vs = `vs ${range.previous}`;
  const nothingBefore = `Nothing to compare with ${range.previous}`;
  const pctNote = (now: number, before: number) => {
    const c = percentChange(now, before);
    return c === null ? { note: nothingBefore } : { note: `${percent(c)} ${vs}`, trend: trendOf(c) };
  };
  const avgNow = perTable(r.now.revenue, r.now.sessions);
  const avgBefore = perTable(r.before.revenue, r.before.sessions);
  const ordersDiff = r.now.orders - r.before.orders;

  const top = r.items.slice(0, 5);
  const categories = byCategory(r.items);
  const categoryMax = categories[0]?.revenue ?? 0;
  const itemsTotal = categories.reduce((n, c) => n + c.revenue, 0);
  const hours = r.hours.length
    ? Array.from({ length: r.hours.at(-1)!.hour - r.hours[0].hour + 1 }, (_, i) => {
        const hour = r.hours[0].hour + i;
        return r.hours.find((h) => h.hour === hour) ?? { hour, orders: 0, revenue: 0 };
      })
    : [];

  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <h1 className="text-display">Revenue</h1>
          <p className="text-muted">
            {range.title} · {REPORT_TIMEZONE}
          </p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-md bg-surface p-1">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={href(x.key, grain)}
              scroll={false}
              replace
              aria-current={x.key === range.key ? "page" : undefined}
              className={`${segment} ${x.key === range.key ? "bg-bg shadow-sm" : "text-muted"}`}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <a href={`/staff/reports/export?range=${range.key}&grain=${grain}`} download className={secondary}>
          Export CSV
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={formatVnd(r.now.revenue)} {...pctNote(r.now.revenue, r.before.revenue)} />
        <Kpi label="Orders" value={String(r.now.orders)} note={`${ordersDiff > 0 ? "+" : ordersDiff < 0 ? "−" : "±"}${Math.abs(ordersDiff)} ${vs}`} trend={trendOf(ordersDiff)} />
        <Kpi label="Avg. per table" value={formatVnd(avgNow)} {...pctNote(avgNow, avgBefore)} />
        <Kpi label="Today so far" value={formatVnd(r.today)} note="Updates when a table closes" />
      </div>

      {r.now.unpaid > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-danger-surface p-3 text-danger">
          <Icon name="info" size={18} className="mt-0.5" />
          <span>
            <b>Unpaid (closed by owner): {formatVnd(r.now.unpaid)}</b> – tables the owner closed before the full bill was
            paid. Not counted as revenue.
          </span>
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Revenue chart" className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-heading flex-1">Revenue by {grain}</h2>
            <span className="text-caption text-muted">Million VND</span>
            <nav aria-label="Group by" className="flex gap-1 rounded-md bg-surface p-1">
              {GRAINS.map((g) => (
                <Link
                  key={g.key}
                  href={href(range.key, g.key)}
                  scroll={false}
                  replace
                  aria-current={g.key === grain ? "page" : undefined}
                  className={`${segment} text-caption ${g.key === grain ? "bg-bg shadow-sm" : "text-muted"}`}
                >
                  {g.label}
                </Link>
              ))}
            </nav>
          </div>
          <BarChart
            label={`Revenue by ${grain}`}
            bars={r.buckets.map((b) => ({
              key: b.bucket,
              label: bucketLabel(b.bucket, grain),
              shortLabel: shortBucketLabel(b.bucket, grain),
              value: b.revenue,
              display: million(b.revenue),
              description: `${bucketLabel(b.bucket, grain)}: ${formatVnd(b.revenue)}`,
            }))}
          />
        </section>

        <section aria-label="Best sellers" className={`${card} gap-1`}>
          <div className="flex items-center gap-3 pb-2">
            <h2 className="text-heading flex-1">Best sellers</h2>
            <a
              href={`/staff/reports/export?range=${range.key}&kind=dishes`}
              download
              aria-label="Export all dishes as CSV"
              className="text-caption rounded-sm font-semibold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Export CSV
            </a>
            <span className="text-caption text-muted">Revenue</span>
          </div>
          {top.length === 0 ? (
            <p className="text-muted">No dishes sold in this period.</p>
          ) : (
            <ol>
              {top.map((i, n) => (
                <li key={i.menu_item_id} className="flex items-center gap-3 py-2">
                  <span className={`text-caption grid size-6 shrink-0 place-items-center rounded-full ${n ? "bg-surface text-muted" : "bg-brand text-white"}`}>
                    {n + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{i.name}</span>
                    <span className="text-caption text-muted">{i.qty} sold</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatVnd(i.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Revenue by category" className={card}>
          <h2 className="text-heading pb-2">Revenue by category</h2>
          {categories.length === 0 ? (
            <p className="text-muted">No dishes sold in this period.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {categories.map((c) => (
                <li key={c.name} className="flex flex-col gap-1">
                  <span className="flex gap-2">
                    <span className="flex-1 font-semibold">{c.name}</span>
                    <span className="tabular-nums">{formatVnd(c.revenue)}</span>
                    <span className="w-12 text-right text-muted tabular-nums">{Math.round((c.revenue / itemsTotal) * 100)}%</span>
                  </span>
                  <span aria-hidden="true" className="h-2 rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${(c.revenue / categoryMax) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Peak hours" className={card}>
          <div className="flex items-center">
            <h2 className="text-heading flex-1">Peak hours</h2>
            <span className="text-caption text-muted">Orders placed</span>
          </div>
          {hours.length === 0 ? (
            <p className="text-muted">No orders in this period.</p>
          ) : (
            <BarChart
              label="Orders by hour"
              bars={hours.map((h) => ({
                key: String(h.hour),
                label: `${h.hour}h`,
                value: h.orders,
                display: String(h.orders),
                description: `${h.hour}:00–${h.hour + 1}:00: ${h.orders} orders, ${formatVnd(h.revenue)}`,
              }))}
            />
          )}
        </section>
      </div>
    </main>
  );
}
