import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/modules/orders/components/cart-view";
import { getTableByCode } from "@/modules/table-session/queries";

export const metadata: Metadata = { title: "Your order · TableTap" };

type Props = { params: Promise<{ tableId: string }> };

export default async function CartPage({ params }: Props) {
  const { tableId } = await params;
  const table = await getTableByCode(tableId);
  if (!table) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <CartView tableCode={table.code} tableLabel={table.label} />
    </main>
  );
}
