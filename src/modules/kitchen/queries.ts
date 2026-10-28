import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Shared by the server (first render) and the browser (realtime + resync). Both pass a client
// that acts as the signed-in staff member, so RLS decides what comes back.
type Client = SupabaseClient<Database>;
type OrderStatus = Database["public"]["Enums"]["order_status"];

export const OPEN_STATUSES: OrderStatus[] = ["pending", "preparing", "ready"];
const SELECT =
  "id, order_no, status, created_at, tables(code, label), order_items(id, name_snapshot, size_name, addons, note, qty)";

export async function fetchOpenOrders(client: Client) {
  const { data, error } = await client
    .from("orders")
    .select(SELECT)
    .in("status", OPEN_STATUSES)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function fetchOrder(client: Client, id: string) {
  const { data, error } = await client.from("orders").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type KitchenOrder = Awaited<ReturnType<typeof fetchOpenOrders>>[number];
