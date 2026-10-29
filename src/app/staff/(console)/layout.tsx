import { databaseInfo } from "@/lib/db-env";
import { Icon } from "@/lib/icons";
import { ConsoleNav } from "@/modules/staff/components/console-nav";
import { SignOutButton } from "@/modules/staff/components/sign-out-button";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

// Staff console shell (prototype `.side`): sidebar on desktop, a top bar on narrow screens.
// The kitchen display lives outside this group because it is full-screen on its tablet.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const db = databaseInfo();
  const items = [
    { href: "/staff/tables", section: "/staff/tables", label: "Tables", icon: "grid", locked: !allowed(staff, CAN.manageTables) },
    { href: "/staff/kitchen", section: "/staff/kitchen", label: "Kitchen", icon: "flame", locked: !allowed(staff, CAN.runKitchen) },
    { href: "/staff/checkout", section: "/staff/checkout", label: "Checkout", icon: "receipt", locked: !allowed(staff, CAN.manageTables) },
    { href: "/staff/reports", section: "/staff/reports", label: "Reports", icon: "chart", locked: !allowed(staff, CAN.viewReports) },
    { href: "/staff/settings", section: "/staff/settings", label: "Settings", icon: "settings", locked: !allowed(staff, CAN.manageSettings) },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-1 border-b border-border bg-surface p-3 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-5 print:hidden">
        <div className="flex items-center gap-2.5 px-2 pb-3 md:pb-5">
          <span className="grid size-9 place-items-center rounded-sm bg-brand text-white">
            <Icon name="utensils" />
          </span>
          <div>
            {/* shortcut: name is fixed until O3 reads restaurant_settings (Phase 5, commit 6) */}
            <p className="text-heading">Phở Mây</p>
            <p className="text-caption text-muted">Staff console</p>
          </div>
        </div>
        <ConsoleNav items={[...items]} />
        <div className="mt-auto flex items-center gap-2.5 p-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-brand font-semibold text-brand-strong">
            {staff.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{staff.displayName}</p>
            <p className="text-caption text-muted capitalize">{staff.role}</p>
          </div>
        </div>
        <SignOutButton className="rounded-sm px-3 py-2 text-muted hover:bg-border/40" />
        {db.deployment !== "production" && (
          // Which database this non-production build uses, so a Preview on the wrong DB is obvious.
          <p
            title={`Supabase project ${db.ref} · ${db.deployment}`}
            className={`text-caption mx-2 mt-1 rounded-sm px-2 py-1 font-semibold tabular-nums ${
              db.misconfigured ? "bg-danger text-white" : "bg-border/60 text-muted"
            }`}
          >
            {db.label} · {db.ref.slice(0, 6)}…
          </p>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        {db.misconfigured && (
          <p role="alert" className="bg-danger px-6 py-3 font-semibold text-white">
            Preview is pointing at the PRODUCTION database. Every change is blocked until the Preview environment
            variables on Vercel point at tabletap-dev.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
