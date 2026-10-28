"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { placeOrderInput, type PlaceOrderInput } from "./schema";

export type PlaceOrderResult = { ok: true; orderId: string } | { ok: false; message: string };

/**
 * Submits the cart as one order. Safe to call again with the same idempotency key (double tap,
 * retry after a timeout): the database returns the order it already created.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Something in your cart looks wrong. Please check it and try again." };
  }
  const { tableCode, idempotencyKey, lines } = parsed.data;

  // shortcut: any active table may order; Phase 5 requires an open session token here.
  const { data, error } = await createAdminClient().rpc("place_order", {
    p_table_code: tableCode,
    p_idempotency_key: idempotencyKey,
    p_lines: lines.map((l) => ({
      menu_item_id: l.menuItemId,
      size_id: l.sizeId,
      addon_ids: l.addonIds,
      note: l.note,
      qty: l.qty,
    })),
  });
  if (error) return { ok: false, message: toGuestMessage(error.message) };
  return { ok: true, orderId: (data as { id: string }).id };
}

/** place_order raises short codes; turn them into copy a guest can act on. */
function toGuestMessage(code: string) {
  if (code.startsWith("ITEM_UNAVAILABLE")) {
    const dish = code.split(": ")[1] ?? "A dish";
    return `${dish} just sold out. Remove it and try again.`;
  }
  if (code === "INVALID_OPTION") return "A dish's options have changed. Remove it and add it again.";
  if (code === "TABLE_NOT_FOUND") return "We can't find this table. Please ask our staff for help.";
  console.error("placeOrder failed:", code);
  return "We couldn't send your order. Please try again.";
}
