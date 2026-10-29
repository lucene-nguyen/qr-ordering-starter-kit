import Link from "next/link";
import { Icon } from "@/lib/icons";

// "/" · what someone sees without a table link: guests order from their table's QR code.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="grid size-[72px] place-items-center rounded-full bg-brand text-white">
        <Icon name="utensils" size={32} />
      </span>
      {/* shortcut: restaurant name is fixed until guests can read restaurant_settings (backlog) */}
      <h1 className="text-display">Phở Mây Kitchen</h1>
      <p className="text-muted">Scan the QR code on your table to order</p>
      <Link
        href="/staff"
        className="text-caption mt-8 rounded-sm px-2 py-1 text-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
      >
        Staff sign in
      </Link>
    </main>
  );
}
