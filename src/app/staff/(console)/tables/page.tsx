import type { Metadata } from "next";
import Link from "next/link";
import { formatVnd } from "@/lib/money";
import { RefreshOnStaffChanges } from "@/lib/realtime-refresh";
import { formatTime } from "@/lib/time";
import { NoAccess } from "@/modules/staff/components/no-access";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";
import { getTableBoard, type TableStatus } from "@/modules/table-session/board";
import { SessionPanel } from "@/modules/table-session/components/session-panel";
import { StatusPill, statusLabel } from "@/modules/table-session/components/table-status";

export const metadata: Metadata = { title: "Tables · TableTap staff" };

type Props = { searchParams: Promise<{ table?: string | string[] }> };

// S1 / S1b · Tables. Owner and cashier only; live through Realtime on sessions, orders and payments.
export default async function TablesPage({ searchParams }: Props) {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) {
    return <NoAccess title="Tables are for the cashier and owner" description="The kitchen display has everything the kitchen needs." />;
  }
  const { table: wanted } = await searchParams;
  const board = await getTableBoard();
  const selected = board.find((t) => t.code === wanted) ?? board.find((t) => t.session) ?? board[0]!;
  const counts = board.reduce<Record<string, number>>((c, t) => ({ ...c, [t.status]: (c[t.status] ?? 0) + 1 }), {});

  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <RefreshOnStaffChanges tables={["table_sessions", "orders", "payments"]} />
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <h1 className="text-display">Tables</h1>
          <p className="text-muted">Open a session so guests can order. Closing it ends the PIN and every guest phone at that table.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["available", "open", "ordering", "awaiting", "paid"] as TableStatus[]).map((s) => (
            <StatusPill key={s} status={s} quiet={!counts[s]}>
              {counts[s] ?? 0} {statusLabel(s).toLowerCase()}
            </StatusPill>
          ))}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3.5">
          {board.map((t) => {
            const current = t.code === selected.code;
            return (
              <Link
                key={t.id}
                href={`/staff/tables?table=${t.code}`}
                aria-current={current ? "true" : undefined}
                className={`flex min-h-28 flex-col gap-1.5 rounded-md bg-bg p-3.5 focus-visible:outline-2 focus-visible:outline-brand ${
                  current ? "border-2 border-brand" : `border border-border ${t.session ? "" : "border-dashed"}`
                }`}
              >
                <span className="text-heading">{t.label}</span>
                <span className="flex flex-wrap gap-1">
                  <StatusPill status={t.status} />
                  {t.session?.idle && <span className="text-caption rounded-full bg-surface-brand px-2.5 py-0.5 text-brand-strong">Idle 3h+</span>}
                </span>
                <span className="text-caption mt-auto flex items-center gap-1.5 text-muted">
                  {t.session ? (
                    <>
                      {t.session.guests.length} guest{t.session.guests.length === 1 ? "" : "s"} · {t.session.minutesOpen} min
                      {t.session.bill > 0 && <b className="ml-auto text-text tabular-nums">{formatVnd(t.session.bill)}</b>}
                    </>
                  ) : (
                    "Tap to open a session"
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        <SessionPanel
          key={`${selected.code}:${selected.session?.id ?? "none"}`}
          table={selected}
          openedAt={selected.session ? formatTime(selected.session.openedAt) : null}
          isOwner={staff.role === "owner"}
        />
      </div>
    </main>
  );
}
