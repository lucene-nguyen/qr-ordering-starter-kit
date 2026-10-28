import type { TableStatus } from "../board";

const STATUS: Record<TableStatus, [label: string, tone: string]> = {
  available: ["Available", "bg-surface text-muted"],
  ordering: ["Ordering", "bg-surface-brand text-brand-strong"],
  awaiting: ["Awaiting payment", "bg-dark text-white"],
  paid: ["Paid", "bg-success-surface text-success"],
};

export const statusLabel = (status: TableStatus) => STATUS[status][0];

export function StatusPill({ status, children }: { status: TableStatus; children?: React.ReactNode }) {
  const [label, tone] = STATUS[status];
  return <span className={`text-caption rounded-full px-2.5 py-0.5 whitespace-nowrap ${tone}`}>{children ?? label}</span>;
}
