import type { Metadata } from "next";
import { connection } from "next/server";
import { PrintButton } from "@/modules/table-session/components/print-button";
import { TableQrCard } from "@/modules/table-session/components/table-qr-card";
import { listTables } from "@/modules/table-session/queries";

export const metadata: Metadata = { title: "Tables & QR · TableTap" };

// O4 · Settings › Tables & QR.
// shortcut: no sign-in yet – the page only shows public table links; it becomes owner-only in Phase 5.
export default async function TablesQrPage() {
  await connection(); // render per request, so tables added later show up (no build-time snapshot)
  const tables = await listTables();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 print:p-0">
      <header className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="flex-1">
          <h1 className="text-display">Tables &amp; QR</h1>
          <p className="text-muted">Each table has its own QR. Print the cards once.</p>
        </div>
        <PrintButton />
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 print:grid-cols-3">
        {tables.map((t) => (
          <TableQrCard key={t.id} code={t.code} label={t.label} />
        ))}
      </div>
    </main>
  );
}
