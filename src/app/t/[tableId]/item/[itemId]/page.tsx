import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { DishPhoto } from "@/modules/menu/components/dish-row";
import { getMenuItem } from "@/modules/menu/queries";
import { getTableByCode } from "@/modules/table-session/queries";

type Props = { params: Promise<{ tableId: string; itemId: string }> };

// 02 · Item, view only. Sizes, add-ons, note and "Add to cart" come with the cart in Phase 2.
export default async function ItemPage({ params }: Props) {
  const { tableId, itemId } = await params;
  const [table, item] = await Promise.all([getTableByCode(tableId), getMenuItem(itemId)]);
  if (!table) notFound();
  if (!item) redirect(`/t/${table.code}`); // stale link to a removed dish: back to the menu

  return (
    <main className="mx-auto min-h-dvh max-w-[480px]">
      <div className="relative">
        <DishPhoto size={200} className="h-[280px] w-full" />
        <Link
          href={`/t/${table.code}`}
          aria-label="Back to menu"
          className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-bg shadow-md focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Icon name="back" size={20} />
        </Link>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h1 className="text-display">{item.name}</h1>
        <p className="text-title tabular-nums text-brand-strong">{formatVnd(item.price)}</p>
        {item.description && <p className="text-muted">{item.description}</p>}
        {!item.is_available && (
          <span className="text-caption self-start rounded-full bg-surface px-2.5 py-0.5 text-muted">
            Sold out today
          </span>
        )}
      </div>
    </main>
  );
}
