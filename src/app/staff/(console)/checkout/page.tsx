import type { Metadata } from "next";
import Link from "next/link";
import { formatVnd } from "@/lib/money";
import { RefreshOnStaffChanges } from "@/lib/realtime-refresh";
import { formatTime } from "@/lib/time";
import { ActionButton } from "@/modules/payments/components/action-button";
import { getCheckout } from "@/modules/payments/queries";
import { CashButton } from "@/modules/payments/components/cash-button";
import { confirmPayment } from "@/modules/payments/staff-actions";
import { NoAccess } from "@/modules/staff/components/no-access";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";
import { getTableBoard } from "@/modules/table-session/board";
import { closeSession } from "@/modules/table-session/staff-actions";

export const metadata: Metadata = { title: "Checkout · TableTap staff" };

type Props = { searchParams: Promise<{ table?: string | string[] }> };

const pill = "text-caption rounded-full px-2.5 py-0.5";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// C2 · Checkout. Owner and cashier: the bill, payment requests to confirm, cash, close the table.
// Live through Realtime on sessions, orders and payments (a guest asking to pay shows up at once).
export default async function CheckoutPage({ searchParams }: Props) {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) {
    return <NoAccess title="Checkout is for the cashier and owner" description="The kitchen display has everything the kitchen needs." />;
  }
  const { table: wanted } = await searchParams;
  const withBills = (await getTableBoard()).filter((t) => t.session && t.session.bill > 0);
  const t = withBills.find((x) => x.code === wanted) ?? withBills[0];
  const live = <RefreshOnStaffChanges tables={["table_sessions", "orders", "payments"]} />;

  if (!t?.session) {
    return (
      <main className="flex flex-col gap-5 px-6 py-6">
        {live}
        <header>
          <h1 className="text-display">Checkout</h1>
          <p className="text-muted">No open bills right now.</p>
        </header>
        <p className="rounded-md border border-dashed border-border p-8 text-center text-muted">
          Bills appear here as soon as a table places its first order.
        </p>
      </main>
    );
  }

  const s = t.session;
  const bill = await getCheckout(s.id);
  if (!bill) return null; // closed between the two reads; the realtime refresh re-renders
  const remaining = Math.max(0, s.remaining);

  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      {live}
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <h1 className="text-display">Checkout · {t.label}</h1>
          <p className="text-muted">
            {plural(s.orders, "order")} · {plural(s.guests.length, "guest")} · opened {formatTime(s.openedAt)}
          </p>
        </div>
        <nav aria-label="Tables with a bill" className="flex flex-wrap gap-2">
          {withBills.map((x) => (
            <Link
              key={x.id}
              href={`/staff/checkout?table=${x.code}`}
              aria-current={x.code === t.code ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-[14px] focus-visible:outline-2 focus-visible:outline-brand ${
                x.code === t.code ? "border-brand bg-surface-brand font-semibold text-brand-strong" : "border-border"
              }`}
            >
              {x.label} · <span className="tabular-nums">{formatVnd(x.session!.bill)}</span>
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <table className="w-full border-collapse overflow-hidden rounded-md border border-border">
          <thead className="bg-surface text-left text-caption text-muted">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Item</th>
              <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
              <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">Unit price</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {l.name}
                  {l.options && <span className="text-caption text-muted"> · {l.options}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{l.qty}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{formatVnd(l.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatVnd(l.unitPrice * l.qty)}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="text-title px-4 py-3" colSpan={2}>Total</td>
              <td className="hidden sm:table-cell" />
              <td className="text-title px-4 py-3 text-right tabular-nums">{formatVnd(s.bill)}</td>
            </tr>
          </tbody>
        </table>

        <section aria-label="Payments" className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <div className="flex items-center">
            <h2 className="text-title flex-1">Payments</h2>
            <span className={`${pill} ${remaining ? "bg-surface-brand text-brand-strong" : "bg-success-surface text-success"}`}>
              {remaining ? "Open" : "Settled"}
            </span>
          </div>
          {bill.payments.length === 0 && <p className="text-muted">No payments yet.</p>}
          {bill.payments.map((p) => {
            const done = p.status === "confirmed";
            return (
              <div key={p.id} className={`flex flex-col gap-2 rounded-md p-3.5 ${done ? "bg-success-surface" : "bg-surface"}`}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold">{p.payer_name ?? "Guest"}</span>
                  <span className="font-semibold tabular-nums">{formatVnd(p.amount)}</span>
                  <span className={`${pill} ${done ? "bg-bg text-success" : "bg-dark text-white"}`}>{done ? "Paid" : "Awaiting"}</span>
                </div>
                <span className="text-caption text-muted">
                  {p.method === "cash" ? "Cash" : `VietQR · ${p.reference}`} · {formatTime(p.confirmed_at ?? p.created_at)}
                  {p.kind === "share" && " · share"}
                </span>
                {!done && (
                  <ActionButton action={confirmPayment.bind(null, p.id)} pendingLabel="Confirming…" className="h-10 rounded-md bg-brand px-3 text-[14px] font-semibold text-white hover:bg-brand-strong">
                    Confirm received
                  </ActionButton>
                )}
              </div>
            );
          })}
          {remaining > 0 && (
            <div className="flex flex-col gap-2.5 rounded-md bg-surface p-3.5">
              <div className="flex items-center">
                <span className="flex-1 font-semibold">Remaining</span>
                <span className="font-semibold tabular-nums text-brand-strong">{formatVnd(remaining)}</span>
              </div>
              <CashButton
                sessionId={s.id}
                amount={remaining}
                awaiting={bill.payments.filter((p) => p.status === "pending").map((p) => ({ name: p.payer_name ?? "A guest", amount: p.amount }))}
              />
            </div>
          )}
          <hr className="border-border" />
          <ActionButton
            action={closeSession.bind(null, s.id, "")}
            disabled={remaining > 0}
            pendingLabel="Closing…"
            className="h-[52px] rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong"
          >
            Close table
          </ActionButton>
          <p className="text-caption text-muted">
            {remaining ? "Close table unlocks once the full bill is paid." : "Closing ends the PIN and every guest phone at this table."}
          </p>
        </section>
      </div>
    </main>
  );
}
