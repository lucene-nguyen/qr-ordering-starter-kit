import Link from "next/link";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import type { MenuItem } from "../types";

/** Placeholder until dish photos can be uploaded (O1b); `image_url` is not rendered yet. */
export function DishPhoto({ size, className = "size-22 rounded-md" }: { size: number; className?: string }) {
  return (
    <div className={`grid shrink-0 place-items-center bg-surface-brand text-brand ${className}`}>
      <Icon name="utensils" size={Math.round(size * 0.36)} strokeWidth={1.5} className="opacity-55" />
    </div>
  );
}

export function DishRow({ item, href }: { item: MenuItem; href: string }) {
  const soldOut = !item.is_available;
  return (
    <Link
      href={href}
      className="flex gap-3 border-b border-border p-4 hover:bg-surface/50 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <DishPhoto size={88} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-heading ${soldOut ? "text-muted" : ""}`}>{item.name}</span>
        {item.description && (
          <span className="text-caption line-clamp-2 text-muted">{item.description}</span>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className={`font-semibold tabular-nums ${soldOut ? "text-muted" : ""}`}>
            {formatVnd(item.price)}
          </span>
          {soldOut && (
            <span className="text-caption ml-auto rounded-full bg-surface px-2.5 py-0.5 text-muted">
              Sold out
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
