import type { Metadata } from "next";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { KitchenBoard } from "@/modules/kitchen/components/kitchen-board";
import { fetchOpenOrders } from "@/modules/kitchen/queries";
import { getMenu } from "@/modules/menu/queries";
import { NoAccess } from "@/modules/staff/components/no-access";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Kitchen · TableTap" };

// K1 · Kitchen display. First render on the server; the board then stays live in the browser.
export default async function KitchenPage() {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.runKitchen)) {
    return <NoAccess title="No kitchen access" description="Ask the owner to give your account a kitchen role." />;
  }
  const [orders, menu] = await Promise.all([fetchOpenOrders(await createAuthClient()), getMenu()]);
  const dishes = menu.flatMap((c) => c.menu_items.map(({ id, name, is_available }) => ({ id, name, is_available })));

  return (
    <KitchenBoard
      initialOrders={orders}
      initialDishes={dishes}
      timeZone={process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh"}
    />
  );
}
