import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RefreshOnBroadcast } from "@/lib/realtime-refresh";
import { CartView } from "@/modules/orders/components/cart-view";
import { getSessionCart } from "@/modules/orders/queries";
import { getGuest } from "@/modules/table-session/guest";
import { getTableByCode } from "@/modules/table-session/queries";

export const metadata: Metadata = { title: "Your order · TableTap" };

type Props = { params: Promise<{ tableId: string }> };

// 03 · Shared cart. Server-rendered from the database; other phones' changes arrive as a
// broadcast on session:<id> and refresh this page (300 ms debounce).
export default async function CartPage({ params }: Props) {
  const { tableId } = await params;
  const table = await getTableByCode(tableId);
  if (!table) notFound();
  const guest = await getGuest(table);
  if (!guest) redirect(`/t/${table.code}`); // not joined yet: the menu shows 00 · Join
  const cart = await getSessionCart(guest.sessionId, guest.guestId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <RefreshOnBroadcast channel={`session:${guest.sessionId}`} event="cart" delayMs={300} />
      <CartView tableCode={table.code} tableLabel={table.label} cart={cart} />
    </main>
  );
}
