"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writesBlocked } from "@/lib/db-env";
import { broadcast } from "@/lib/realtime-notify";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

export type CheckoutResult = { ok: true } | { ok: false; message: string };

const NOT_ALLOWED = "Only the cashier or the owner can take payments.";

/** After a payment changes: the guest's phone flips to 06 (or back to 05), C2 and S1 re-read. */
async function announce(sessionId: string) {
  await broadcast(`session:${sessionId}`, "payment");
  revalidatePath("/staff/checkout");
  revalidatePath("/staff/tables");
}

/**
 * C2 · "Confirm received": the cashier saw the transfer arrive in the bank app. Runs as the staff
 * member: RLS + the column grant allow only status, the trigger allows only pending → confirmed
 * and stamps who/when.
 */
export async function confirmPayment(paymentId: string): Promise<CheckoutResult> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { ok: false, message: blocked };
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) return { ok: false, message: NOT_ALLOWED };
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, message: "Unknown payment." };

  const { data, error } = await (await createAuthClient())
    .from("payments")
    .update({ status: "confirmed" })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("session_id");
  if (error) {
    console.error("confirmPayment failed:", error.message);
    return { ok: false, message: "Couldn't confirm the payment. Try again." };
  }
  if (!data.length) return { ok: false, message: "This request was already confirmed or withdrawn." };
  await announce(data[0]!.session_id);
  return { ok: true };
}

/** C2 · "Paid in cash": one confirmed cash payment for everything still open (record_cash_payment). */
export async function recordCash(sessionId: string): Promise<CheckoutResult> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { ok: false, message: blocked };
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) return { ok: false, message: NOT_ALLOWED };
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "Unknown table." };

  const { error } = await (await createAuthClient()).rpc("record_cash_payment", { p_session_id: sessionId });
  if (error) {
    if (error.message === "NOTHING_TO_PAY") return { ok: false, message: "Nothing is left to pay." };
    if (error.message === "SESSION_CLOSED") return { ok: false, message: "This table was already closed." };
    console.error("recordCash failed:", error.message);
    return { ok: false, message: "Couldn't record the cash payment. Try again." };
  }
  await announce(sessionId);
  return { ok: true };
}
