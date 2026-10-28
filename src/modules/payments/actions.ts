"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { writesBlocked } from "@/lib/db-env";
import { broadcast } from "@/lib/realtime-notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGuest } from "@/modules/table-session/guest";
import { getTableByCode } from "@/modules/table-session/queries";

export type PayState = { error: string | null };

const input = z.object({
  tableCode: z.string().min(1).max(10),
  mode: z.enum(["full", "share"]),
  people: z.coerce.number().int().min(2).max(8).optional(),
});

/** The guest of this table behind the tt_guest cookie, or a redirect to the table's start screen. */
async function guestAt(tableCode: string) {
  const table = await getTableByCode(tableCode);
  if (!table) redirect("/");
  const guest = await getGuest(table);
  if (!guest) redirect(`/t/${tableCode}`); // joined nowhere, or staff closed the table: 00 / 00b
  return guest;
}

/**
 * 05 · "Show payment QR". The database computes the amount (full bill or the next equal share) and
 * the transfer note; asking again returns the same pending request. Then the QR screen shows it.
 */
export async function requestPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { error: blocked };

  const parsed = input.safeParse({
    tableCode: formData.get("tableCode"),
    mode: formData.get("mode"),
    people: formData.get("people") ?? undefined,
  });
  if (!parsed.success) return { error: "Choose the full bill, or split between 2 and 8 people." };
  const { tableCode, mode, people } = parsed.data;
  const guest = await guestAt(tableCode);

  const { data, error } = await createAdminClient().rpc("request_payment", {
    p_table_code: tableCode,
    p_guest: guest.guestId,
    p_mode: mode,
    p_people: people ?? 0, // ignored for 'full' and once the split is fixed; 0 is an INVALID_SPLIT otherwise
  });
  if (error) {
    if (error.message === "SESSION_CLOSED" || error.message === "GUEST_NOT_FOUND") redirect(`/t/${tableCode}`);
    if (error.message === "NOTHING_TO_PAY") return { error: "There's nothing left to pay at this table." };
    if (error.message === "INVALID_SPLIT") return { error: "Each share must be at least 1.000đ – split between fewer people." };
    console.error("requestPayment failed:", error.message);
    return { error: "We couldn't prepare your payment. Please try again or pay at the counter." };
  }
  await broadcast(`session:${guest.sessionId}`, "payment"); // C2 / S1 and the table's other phones
  redirect(`/t/${tableCode}/pay/${(data as { id: string }).id}`);
}

/** 05b · "Pay at the counter instead": withdraw this guest's pending request. */
export async function cancelPayment(tableCode: string): Promise<PayState> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { error: blocked };
  if (!z.string().min(1).max(10).safeParse(tableCode).success) return { error: "Unknown table." };
  const guest = await guestAt(tableCode);

  const { error } = await createAdminClient().rpc("cancel_payment", { p_table_code: tableCode, p_guest: guest.guestId });
  if (error) {
    if (error.message === "SESSION_CLOSED" || error.message === "GUEST_NOT_FOUND") redirect(`/t/${tableCode}`);
    console.error("cancelPayment failed:", error.message);
    return { error: "Couldn't cancel. Please tell our staff you'll pay at the counter." };
  }
  await broadcast(`session:${guest.sessionId}`, "payment");
  redirect(`/t/${tableCode}/pay?counter=1`);
}
