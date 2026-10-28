import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SharedCartLine } from "./types";

/**
 * The table's shared cart as `guestId` sees it, plus what is needed around it. Guests have no RLS
 * access to these tables; callers must have checked the guest cookie first (getGuest).
 */
export async function getSessionCart(sessionId: string, guestId: string) {
  const db = createAdminClient();
  const [{ data: session, error }, { data: orders }] = await Promise.all([
    db
      .from("table_sessions")
      .select(
        "cart_version, session_guests(id, display_name, joined_at), cart_items(id, qty, note, addon_ids, created_at, added_by, menu_items(name, price), menu_item_sizes(name, extra_price))",
      )
      .eq("id", sessionId)
      .order("created_at", { referencedTable: "cart_items" })
      .order("joined_at", { referencedTable: "session_guests" })
      .single(),
    db.from("orders").select("id, total").eq("session_id", sessionId).neq("status", "cancelled").order("created_at"),
  ]);
  if (error) throw error;

  const addonIds = [...new Set(session.cart_items.flatMap((c) => c.addon_ids))];
  const { data: addons } = addonIds.length
    ? await db.from("menu_item_addons").select("id, name, extra_price, sort").in("id", addonIds).order("sort")
    : { data: [] };
  const names = new Map(session.session_guests.map((g) => [g.id, g.display_name]));

  const lines: SharedCartLine[] = session.cart_items.map((c) => {
    const chosen = (addons ?? []).filter((a) => c.addon_ids.includes(a.id));
    const size = c.menu_item_sizes;
    return {
      id: c.id,
      name: c.menu_items.name,
      options: [size?.name, ...chosen.map((a) => a.name)].filter(Boolean).join(" · "),
      note: c.note,
      qty: c.qty,
      unitPrice: c.menu_items.price + (size?.extra_price ?? 0) + chosen.reduce((n, a) => n + a.extra_price, 0),
      addedBy: c.added_by === guestId ? "you" : (names.get(c.added_by) ?? "Guest"),
    };
  });

  return {
    cartVersion: session.cart_version,
    lines,
    me: names.get(guestId) ?? "You",
    others: session.session_guests.filter((g) => g.id !== guestId).map((g) => g.display_name),
    alreadyOrdered: (orders ?? []).reduce((n, o) => n + o.total, 0),
    latestOrderId: orders?.at(-1)?.id ?? null, // for "Track your order"
  };
}

export type SessionCart = Awaited<ReturnType<typeof getSessionCart>>;

const ORDER_SELECT =
  "id, order_no, status, total, created_at, session_id, tables(code, label), order_items(id, name_snapshot, unit_price, size_name, addons, note, qty)";

/**
 * One order with its items, for the guest's status screen. Guests have no RLS access to orders,
 * so this reads with the secret key; the unguessable order id in the URL is what grants access.
 */
export async function getOrder(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createAdminClient().from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Every round of a table session, oldest first (cancelled ones left out). */
export async function getSessionOrders(sessionId: string) {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
    .order("created_at");
  if (error) throw error;
  return data;
}
