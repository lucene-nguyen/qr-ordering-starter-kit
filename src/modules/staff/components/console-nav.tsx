"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lib/icons";

// `section`: the URL prefix that counts as "this page" (Settings has several tabs later).
type Item = { href: string; section: string; label: string; icon: "grid" | "flame" | "settings"; locked: boolean };

/** Sidebar links; a lock marks pages this role can't use (they open the no-access screen). */
export function ConsoleNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff console" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const current = pathname.startsWith(item.section);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-3 rounded-sm px-3 py-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand ${
              current ? "bg-bg font-semibold text-text shadow-sm [&>svg:first-child]:text-brand-strong" : "text-muted hover:bg-border/40"
            }`}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
            {item.locked && <Icon name="lock" size={14} className="ml-auto opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}
