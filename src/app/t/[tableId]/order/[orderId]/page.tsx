import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { RefreshOnBroadcast } from "@/lib/realtime-refresh";
import { formatTime } from "@/lib/time";
import { PageNav } from "@/modules/orders/components/page-nav";
import { getOrder, getSessionOrders } from "@/modules/orders/queries";

export const metadata: Metadata = { title: "Order status · TableTap" };

type Props = {
  params: Promise<{ tableId: string; orderId: string }>;
  searchParams: Promise<{ sent_by?: string | string[] }>;
};

const STEPS = ["Order received", "Preparing", "Ready to serve", "Served"];
const STAGE = {
  pending: { step: 0, icon: "clock", title: "Waiting for the kitchen to accept", hint: "Usually under a minute" },
  preparing: { step: 1, icon: "flame", title: "The kitchen is preparing your food", hint: "About 10–15 minutes" },
  ready: { step: 2, icon: "bell", title: "Your food is ready", hint: "A server is bringing it to your table" },
  served: { step: 3, icon: "checkCircle", title: "Enjoy your meal", hint: "Order more anytime" },
} as const;
const PILL = {
  pending: ["Received", "bg-surface text-muted"],
  preparing: ["Preparing", "bg-surface-brand text-brand-strong"],
  ready: ["Ready", "bg-success-surface text-success"],
  served: ["Served", "bg-success-surface text-success"],
} as const;

// 04 · Order status with rounds. A table session's orders are shown together: the hero and steps
// follow the latest round, the item list covers every round. Live: kitchen status changes and new
// rounds broadcast on session:<id>, and this page re-reads the orders.
export default async function OrderStatusPage({ params, searchParams }: Props) {
  const [{ tableId, orderId }, { sent_by }] = await Promise.all([params, searchParams]);
  // Set when this guest pressed Place order just after someone else sent the same cart.
  const sentBy = typeof sent_by === "string" ? sent_by.slice(0, 20) : null;
  const order = await getOrder(orderId);
  // Unknown id or another table's order: back to this table's menu (which 404s for a bad table).
  if (!order || order.tables.code !== tableId || order.status === "cancelled") redirect(`/t/${tableId}`);

  const rounds = order.session_id ? await getSessionOrders(order.session_id) : [order];
  const latest = rounds.at(-1) ?? order;
  const stage = STAGE[latest.status as keyof typeof STAGE];
  const roundCount = `${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <RefreshOnBroadcast
        channel={order.session_id ? `session:${order.session_id}` : `order:${order.id}`}
        events={["status", "cart"]}
      />
      <PageNav back={`/t/${tableId}`} title={`Order #${latest.order_no}`} subtitle={`${order.tables.label} · ${roundCount}`} />

      <div className="flex-1">
        {sentBy && (
          <p role="status" className="mx-4 my-2 flex items-center gap-2 rounded-md bg-surface p-3 text-muted">
            <Icon name="users" size={18} /> {sentBy} just sent this round.
          </p>
        )}
        <section className={`mx-4 my-2 flex flex-col gap-2 rounded-lg p-5 ${stage.step === 3 ? "bg-success-surface" : "bg-surface-brand"}`}>
          <span className={`grid size-10 place-items-center rounded-full text-white ${stage.step === 3 ? "bg-success" : "bg-brand"}`}>
            <Icon name={stage.icon} size={20} />
          </span>
          <p className="text-title">{stage.title}</p>
          <p className="flex items-center gap-2 text-muted">
            <Icon name="clock" size={16} /> {stage.hint}
          </p>
        </section>

        <ol className="flex flex-col px-6 py-4">
          {STEPS.map((label, i) => {
            const done = i < stage.step || (i === 0 && stage.step > 0);
            const current = i === stage.step;
            return (
              <li key={label} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className={`grid size-[22px] place-items-center rounded-full ${
                      done ? "bg-success text-white" : current ? "border-[6px] border-brand" : "border-2 border-border"
                    }`}
                  >
                    {done && <Icon name="check" size={13} strokeWidth={3} />}
                  </span>
                  {i < STEPS.length - 1 && <i className={`h-6 w-0.5 ${done ? "bg-success" : "bg-border"}`} />}
                </div>
                <div>
                  <p className={i > stage.step ? "text-muted" : "font-semibold"}>{label}</p>
                  {i === 0 && <p className="text-caption text-muted">{formatTime(latest.created_at)}</p>}
                  {current && i > 0 && <p className="text-caption text-brand-strong">Now</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <h2 className="text-heading px-4 pb-2">Items</h2>
        {rounds.map((round, r) => {
          const [pillLabel, pillTone] = PILL[round.status as keyof typeof PILL];
          return (
            <section key={round.id} aria-label={`Round ${r + 1}`}>
              {rounds.length > 1 && (
                <p className="text-caption bg-surface px-4 py-1.5 text-muted">
                  Round {r + 1} · #{round.order_no} · {formatTime(round.created_at)}
                </p>
              )}
              <ul>
                {round.order_items.map((item) => {
                  const addons = (item.addons as { name: string }[]).map((a) => a.name);
                  const options = [item.size_name, ...addons].filter(Boolean).join(" · ");
                  return (
                    <li key={item.id} className="flex items-start gap-2 border-b border-border px-4 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span>
                          {item.name_snapshot} <span className="text-muted">×{item.qty}</span>
                        </span>
                        {options && <span className="text-caption text-muted">{options}</span>}
                        {item.note && <span className="text-caption text-brand-strong">Note: {item.note}</span>}
                      </div>
                      <span className={`text-caption rounded-full px-2.5 py-0.5 ${pillTone}`}>{pillLabel}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <div className="text-heading flex px-4 py-3">
          <span className="flex-1">{rounds.length > 1 ? "Table total" : "Total"}</span>
          <span className="tabular-nums">{formatVnd(rounds.reduce((n, o) => n + o.total, 0))}</span>
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        <Link
          href={`/t/${tableId}`}
          className="flex h-[52px] flex-1 items-center justify-center rounded-md border border-border font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
        >
          Order more
        </Link>
        <Link
          href={`/t/${tableId}/pay`}
          className="flex h-[52px] flex-1 items-center justify-center rounded-md bg-brand font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Request bill
        </Link>
      </div>
    </main>
  );
}
