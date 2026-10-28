"use server";

import { writesBlocked } from "@/lib/db-env";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { broadcast } from "@/lib/realtime-notify";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";
import { getTableByCode } from "./queries";

export type SessionResult = { ok: true } | { ok: false; message: string };

const NOT_ALLOWED = "Only the cashier or the owner can open and close tables.";

/**
 * S1b · Open a session. Runs as the staff member: RLS lets owner/cashier insert, the column grant
 * only allows table_id, and the database generates the PIN and stamps opened_by.
 */
export async function openSession(tableCode: string): Promise<SessionResult> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { ok: false, message: blocked };

  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) return { ok: false, message: NOT_ALLOWED };
  const table = z.string().min(1).max(10).safeParse(tableCode).success ? await getTableByCode(tableCode) : null;
  if (!table) return { ok: false, message: "Unknown table." };

  const { error } = await (await createAuthClient()).from("table_sessions").insert({ table_id: table.id });
  if (error) {
    if (error.code === "23505") return { ok: false, message: `${table.label} is already open.` }; // one open session per table
    console.error("openSession failed:", error.message);
    return { ok: false, message: "Couldn't open the table. Try again." };
  }
  revalidatePath("/staff/tables");
  return { ok: true };
}

const closeInput = z.object({ sessionId: z.uuid(), reason: z.string().trim().max(200) });

/**
 * Close a session. The database trigger decides: paid → anyone of owner/cashier; still owing →
 * only the owner, with a reason. Closing ends the PIN and every guest phone of that session.
 */
export async function closeSession(sessionId: string, reason: string): Promise<SessionResult> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  if (blocked) return { ok: false, message: blocked };

  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageTables)) return { ok: false, message: NOT_ALLOWED };
  const parsed = closeInput.safeParse({ sessionId, reason });
  if (!parsed.success) return { ok: false, message: "Keep the reason under 200 characters." };

  const { data, error } = await (await createAuthClient())
    .from("table_sessions")
    .update({ status: "closed", closed_reason: parsed.data.reason || null })
    .eq("id", parsed.data.sessionId)
    .eq("status", "open")
    .select("id");
  if (error) {
    if (error.message === "UNPAID") {
      return { ok: false, message: "This table still owes money. Settle the bill first – only the owner can close an unpaid table." };
    }
    if (error.message === "REASON_REQUIRED") return { ok: false, message: "Write why you are closing an unpaid table." };
    console.error("closeSession failed:", error.message);
    return { ok: false, message: "Couldn't close the table. Try again." };
  }
  if (!data.length) return { ok: false, message: "This table was already closed." };

  // Guests' phones re-read and land on "paid" / "table isn't open" (ADR 0003, D).
  await broadcast(`session:${parsed.data.sessionId}`, "closed");
  revalidatePath("/staff/tables");
  revalidatePath("/staff/checkout");
  return { ok: true };
}
