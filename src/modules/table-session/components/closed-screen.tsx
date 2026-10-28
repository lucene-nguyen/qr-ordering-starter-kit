import Link from "next/link";
import { Icon } from "@/lib/icons";

/** 00b · No open session on this table: ordering waits for staff; the menu can still be browsed. */
export function ClosedScreen({ tableCode }: { tableCode: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-22 place-items-center rounded-full bg-surface text-muted">
          <Icon name="lock" size={40} />
        </div>
        <h1 className="text-display">This table isn&apos;t open yet</h1>
        <p className="max-w-[300px] text-muted">
          To prevent orders from outside the restaurant, ordering starts once our staff opens a session for your
          table.
        </p>
        <span className="text-caption flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-muted">
          <Icon name="clock" size={14} /> Ask our staff for the table PIN
        </span>
      </div>
      <div className="px-4 pt-3.5 pb-7">
        <Link
          href={`/t/${tableCode}?view=menu`}
          className="flex h-[52px] items-center justify-center rounded-md border border-border font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
        >
          View menu only
        </Link>
      </div>
    </main>
  );
}
