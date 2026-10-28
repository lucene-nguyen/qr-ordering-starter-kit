"use client";

import { useParams } from "next/navigation";
import { Icon } from "@/lib/icons";

// 00a · Table not found. not-found files get no props, so the table code comes from the URL.
export default function TableNotFound() {
  const { tableId } = useParams<{ tableId: string }>();
  const code = decodeURIComponent(tableId ?? "").slice(0, 12);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-22 place-items-center rounded-full bg-surface text-muted">
        <Icon name="search" size={40} />
      </div>
      <h1 className="text-display">We can&apos;t find Table {code}</h1>
      <p className="max-w-[300px] text-muted">
        This QR code may be damaged or belong to another restaurant. Scan the code on your table
        again, or ask our staff for help.
      </p>
      <span className="text-caption rounded-full bg-surface px-2.5 py-0.5 text-muted">
        Error code: TABLE_NOT_FOUND
      </span>
    </main>
  );
}
