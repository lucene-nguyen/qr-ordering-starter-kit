import type { TableStatus } from "../board";

const QUIET = "bg-surface text-muted";
const STATUS: Record<TableStatus, [label: string, tone: string]> = {
  available: ["Available", QUIET],
  open: ["Open", "bg-bg text-brand-strong ring-1 ring-inset ring-brand/40"], // opened, nobody joined yet
  ordering: ["Ordering", "bg-surface-brand text-brand-strong"],
  awaiting: ["Awaiting payment", "bg-dark text-white"],
  paid: ["Paid", "bg-success-surface text-success"],
};

export const statusLabel = (status: TableStatus) => STATUS[status][0];

/** `quiet`: plain style, e.g. a legend count of 0 shouldn't shout (prototype). */
export function StatusPill({ status, quiet, children }: { status: TableStatus; quiet?: boolean; children?: React.ReactNode }) {
  const [label, tone] = STATUS[status];
  return <span className={`text-caption rounded-full px-2.5 py-0.5 whitespace-nowrap ${quiet ? QUIET : tone}`}>{children ?? label}</span>;
}
