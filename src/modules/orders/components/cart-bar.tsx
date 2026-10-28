import Link from "next/link";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";

/** Dark "View cart" bar pinned to the bottom of the menu while the shared cart has items. */
export function CartBar({ tableCode, count, total }: { tableCode: string; count: number; total: number }) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-0 border-t border-border bg-bg px-4 pt-3.5 pb-7">
      <Link
        href={`/t/${tableCode}/cart`}
        className="flex items-center gap-3 rounded-md bg-dark px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="relative grid size-8 place-items-center rounded-full bg-brand">
          <Icon name="bag" size={16} />
          <b className="absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1 text-[11px] text-brand-strong tabular-nums">
            {count}
          </b>
        </span>
        <span className="flex-1">
          <span className="block font-semibold">View cart</span>
          <span className="text-caption opacity-70">
            {count} {count === 1 ? "item" : "items"} · shared with your table
          </span>
        </span>
        <span className="text-heading tabular-nums">{formatVnd(total)}</span>
      </Link>
    </div>
  );
}
