import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/lib/icons";
import { RefreshOnBroadcast, RefreshOnTableUpdate } from "@/lib/realtime-refresh";
import { DishRow } from "@/modules/menu/components/dish-row";
import { getMenu } from "@/modules/menu/queries";
import { CartBar } from "@/modules/orders/components/cart-bar";
import { getSessionCart } from "@/modules/orders/queries";
import { cartCount, cartTotal } from "@/modules/orders/types";
import { JoinScreen } from "@/modules/table-session/components/join-screen";
import { getGuest, getOpenSession } from "@/modules/table-session/guest";
import { getTableByCode } from "@/modules/table-session/queries";
import { formatTime } from "@/lib/time";

type Props = {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tableId } = await params;
  return { title: `Menu · Table ${tableId} · TableTap` };
}

export default async function TableMenuPage({ params, searchParams }: Props) {
  const [{ tableId }, { q }] = await Promise.all([params, searchParams]);
  const search = typeof q === "string" ? q.trim() : "";
  const [table, menu] = await Promise.all([getTableByCode(tableId), getMenu(search)]);
  if (!table) notFound();

  const guest = await getGuest(table);
  if (!guest) {
    const open = await getOpenSession(table.id);
    return (
      <JoinScreen
        tableCode={table.code}
        tableLabel={table.label}
        openedAt={open ? formatTime(open.openedAt) : null}
        guestNames={open?.guestNames ?? []}
      />
    );
  }

  const cart = await getSessionCart(guest.sessionId, guest.guestId);
  const itemHref = (id: string) => `/t/${table.code}/item/${id}`;
  const popular = menu.flatMap((c) => c.menu_items.filter((i) => i.is_popular));

  return (
    <main className="mx-auto min-h-dvh max-w-[480px]">
      <RefreshOnTableUpdate table="menu_items" />
      <RefreshOnBroadcast channel={`session:${guest.sessionId}`} events={["cart"]} />
      <header className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">Welcome, {guest.displayName}</p>
            {/* shortcut: restaurant name is fixed until restaurant_settings lands (Phase 5) */}
            <h1 className="text-display">Phở Mây Kitchen</h1>
          </div>
          <span className="rounded-full bg-surface-brand px-3 py-2 text-[13px] font-medium whitespace-nowrap text-brand-strong">
            {table.label}
          </span>
        </div>

        {/* A plain GET form: the server filters the menu, so search works without client JS. */}
        <form
          role="search"
          className="flex h-11 items-center gap-2 rounded-md bg-surface px-3 text-muted focus-within:ring-2 focus-within:ring-brand"
        >
          <Icon name="search" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search dishes, drinks…"
            aria-label="Search dishes"
            className="h-full min-w-0 flex-1 bg-transparent text-text outline-none"
          />
        </form>
      </header>

      {search ? (
        <section>
          <h2 className="text-title px-4 pt-4 pb-1">Results for “{search}”</h2>
          {menu.length === 0 ? (
            <p className="px-6 py-10 text-center text-muted">No dishes match “{search}”.</p>
          ) : (
            menu.flatMap((c) => c.menu_items).map((item) => (
              <DishRow key={item.id} item={item} href={itemHref(item.id)} />
            ))
          )}
        </section>
      ) : (
        <>
          <nav
            aria-label="Categories"
            className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-bg px-4 py-2 [scrollbar-width:none]"
          >
            {popular.length > 0 && <CategoryChip href="#popular" label="Popular" />}
            {menu.map((c) => (
              <CategoryChip key={c.id} href={`#cat-${c.id}`} label={c.name} />
            ))}
          </nav>

          {popular.length > 0 && (
            <section id="popular" className="scroll-mt-14">
              <h2 className="text-title px-4 pt-4 pb-1">Popular today</h2>
              {popular.map((item) => (
                <DishRow key={item.id} item={item} href={itemHref(item.id)} />
              ))}
            </section>
          )}
          {menu.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-14">
              <h2 className="text-title px-4 pt-4 pb-1">{c.name}</h2>
              {c.menu_items.map((item) => (
                <DishRow key={item.id} item={item} href={itemHref(item.id)} />
              ))}
            </section>
          ))}
        </>
      )}
      <CartBar
        tableCode={table.code}
        count={cartCount(cart.lines)}
        total={cartTotal(cart.lines)}
        latestOrderId={cart.latestOrderId}
      />
    </main>
  );
}

function CategoryChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-full bg-surface px-4 py-2 text-[13px] font-medium whitespace-nowrap hover:bg-dark hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
    >
      {label}
    </a>
  );
}
