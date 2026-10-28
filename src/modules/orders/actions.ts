"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { broadcast } from "@/lib/realtime-notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGuest } from "@/modules/table-session/guest";
import { getTableByCode } from "@/modules/table-session/queries";
import { cartLineInput, cartVersionInput, deltaInput, tableCodeInput, type CartLineInput } from "./schema";

export type CartResult = { ok: true } | { ok: false; message: string };
export type PlaceResult =
  | { ok: true; orderId: string; sentBy: string | null } // sentBy: someone else had just sent this round
  | { ok: false; message: string; cartChanged?: boolean };

const SESSION_ENDED = "Your table session has ended. Reload the page to join again.";

/** The guest behind this request's cookie, at this table – the only guest credential. */
async function currentGuest(tableCode: string) {
  if (!tableCodeInput.safeParse(tableCode).success) return null;
  const table = await getTableByCode(tableCode);
  return table ? getGuest(table) : null;
}

/**
 * After a cart change: the other phones at the table hear the broadcast and re-read the cart
 * themselves; this phone gets fresh data in the same response (revalidatePath). Broadcast first,
 * so the other phones start their refresh as early as possible.
 */
async function cartChanged(tableCode: string, sessionId: string) {
  await broadcast(`session:${sessionId}`, "cart");
  revalidatePath(`/t/${tableCode}`, "layout");
}

/** The database raises short codes; turn them into words a guest can act on. */
function toGuestMessage(code: string) {
  if (code.startsWith("ITEM_UNAVAILABLE")) {
    const dish = code.split(": ")[1] ?? "A dish";
    return `${dish} just sold out. Remove it and try again.`;
  }
  switch (code) {
    case "SESSION_CLOSED":
    case "GUEST_NOT_FOUND":
      return SESSION_ENDED;
    case "INVALID_OPTION":
      return "This dish's options have changed. Remove it and add it again.";
    case "INVALID_QTY":
      return "Choose a quantity between 1 and 50.";
    case "CART_CHANGED":
      return "Cart changed, check it again";
    case "CART_EMPTY":
      return "Your cart is empty.";
  }
  console.error("cart action failed:", code);
  return "Something went wrong. Please try again.";
}

export async function addToCart(tableCode: string, line: CartLineInput): Promise<CartResult> {
  const parsed = cartLineInput.safeParse(line);
  if (!parsed.success) return { ok: false, message: "Something in this dish looks wrong. Please try again." };
  const guest = await currentGuest(tableCode);
  if (!guest) return { ok: false, message: SESSION_ENDED };

  const { menuItemId, sizeId, addonIds, note, qty } = parsed.data;
  const { error } = await createAdminClient().rpc("cart_add", {
    p_table_code: tableCode,
    p_guest: guest.guestId,
    p_line: { menu_item_id: menuItemId, size_id: sizeId, addon_ids: addonIds, note, qty },
  });
  if (error) return { ok: false, message: toGuestMessage(error.message) };
  await cartChanged(tableCode, guest.sessionId);
  return { ok: true };
}

/** +1 / −1 on a cart line (anyone at the table may change any line; deltas add up safely). */
export async function changeQty(tableCode: string, itemId: string, delta: number): Promise<CartResult> {
  if (!z.uuid().safeParse(itemId).success || !deltaInput.safeParse(delta).success) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  const guest = await currentGuest(tableCode);
  if (!guest) return { ok: false, message: SESSION_ENDED };

  const { error } = await createAdminClient().rpc("cart_change", {
    p_table_code: tableCode,
    p_guest: guest.guestId,
    p_item: itemId,
    p_delta: delta,
  });
  if (error) return { ok: false, message: toGuestMessage(error.message) };
  await cartChanged(tableCode, guest.sessionId);
  return { ok: true };
}

/**
 * Sends the shared cart as one round. `cartVersion` is the cart the guest was looking at:
 * if someone already sent it, we return that order; if it changed, nothing is sent.
 */
export async function placeRound(tableCode: string, cartVersion: number): Promise<PlaceResult> {
  if (!cartVersionInput.safeParse(cartVersion).success) return { ok: false, message: "Something went wrong. Please try again." };
  const guest = await currentGuest(tableCode);
  if (!guest) return { ok: false, message: SESSION_ENDED };

  const { data, error } = await createAdminClient().rpc("place_session_order", {
    p_table_code: tableCode,
    p_guest: guest.guestId,
    p_cart_version: cartVersion,
  });
  if (error) {
    const cartChangedUnder = error.message === "CART_CHANGED";
    if (cartChangedUnder) revalidatePath(`/t/${tableCode}`, "layout"); // show the cart as it is now
    return { ok: false, message: toGuestMessage(error.message), cartChanged: cartChangedUnder };
  }
  const order = data as { id: string; already_sent: boolean; sent_by?: string };
  if (!order.already_sent) await cartChanged(tableCode, guest.sessionId); // everyone's cart is now empty
  return { ok: true, orderId: order.id, sentBy: order.already_sent ? (order.sent_by ?? "Someone") : null };
}
