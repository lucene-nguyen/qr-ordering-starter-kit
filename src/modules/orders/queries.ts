import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One order with its items, for the guest's status screen. Guests have no RLS access to orders,
 * so this reads with the secret key; the unguessable order id in the URL is what grants access.
 */
export async function getOrder(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(
      "id, order_no, status, total, created_at, tables(code, label), order_items(id, name_snapshot, unit_price, size_name, addons, note, qty)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
