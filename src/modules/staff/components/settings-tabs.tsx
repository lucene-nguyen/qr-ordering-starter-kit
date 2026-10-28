import Link from "next/link";

const TABS = [
  { href: "/staff/settings", label: "Payment" },
  { href: "/staff/settings/qr", label: "Tables & QR" },
];

/** O3 / O4 tabs. */
export function SettingsTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Settings" className="flex w-max max-w-full gap-1 rounded-md bg-surface p-1 print:hidden">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={`rounded-sm px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-brand ${
            t.href === current ? "bg-bg shadow-sm" : "text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
