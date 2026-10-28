import type { Metadata } from "next";
import { headers } from "next/headers";
import { NoAccess } from "@/modules/staff/components/no-access";
import { SettingsTabs } from "@/modules/staff/components/settings-tabs";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";
import { PrintButton } from "@/modules/table-session/components/print-button";
import { TableQrCard } from "@/modules/table-session/components/table-qr-card";
import { listTables, tableUrl } from "@/modules/table-session/queries";

export const metadata: Metadata = { title: "Tables & QR · TableTap" };

// O4 · Settings › Tables & QR. Owner only.
export default async function TablesQrPage() {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageSettings)) {
    return (
      <NoAccess
        title="Settings are for the owner"
        description="Bank details and table QR codes can only be changed by the owner."
      />
    );
  }

  // QR links use the domain this page is served from (localhost, preview or production), so there
  // is no base-URL setting to get wrong. Reading headers also makes the page render per request.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
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
      <SettingsTabs current="/staff/settings/qr" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 print:grid-cols-3">
        {tables.map((t) => (
          <TableQrCard key={t.id} url={tableUrl(t.code, origin)} label={t.label} />
        ))}
      </div>
    </main>
  );
}
