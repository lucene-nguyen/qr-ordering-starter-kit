"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

/** The order state machine: each status has exactly one next step. */
const NEXT = { pending: "preparing", preparing: "ready", ready: "served" } as const;
type From = keyof typeof NEXT;

export type AdvanceResult = { ok: true; status: (typeof NEXT)[From] } | { ok: false; message: string };

const input = z.object({ orderId: z.uuid(), from: z.enum(["pending", "preparing", "ready"]) });

export async function advanceOrder(orderId: string, from: From): Promise<AdvanceResult> {
  const parsed = input.safeParse({ orderId, from });
  if (!parsed.success) return { ok: false, message: "Unknown order." };
  const staff = await requireStaff();
  if (!allowed(staff, CAN.runKitchen)) return { ok: false, message: "Your role can't update orders." };

  const to = NEXT[parsed.data.from];
  // Runs as the staff member (RLS + column grant apply). `status = from` makes it a
  // compare-and-set: if another tablet moved the order first, nothing is updated.
  const { data, error } = await (await createAuthClient())
    .from("orders")
    .update({ status: to })
    .eq("id", orderId)
    .eq("status", parsed.data.from)
    .select("id");
  if (error) {
    console.error("advanceOrder failed:", error.message);
    return { ok: false, message: "Couldn't update the order. Try again." };
  }
  if (!data.length) return { ok: false, message: "This order was already updated on another screen." };

  await notifyGuest(orderId, to);
  return { ok: true, status: to };
}

/**
 * Tells the guest's status page that something changed. It only triggers a re-read on the
 * server, so a forged message on this public channel can't show a wrong status (ADR 0002).
 * Sent over HTTP: no WebSocket needed from a Server Action. A failure must not undo the update.
 */
async function notifyGuest(orderId: string, status: string) {
  try {
    const admin = createAdminClient();
    const channel = admin.channel(`order:${orderId}`);
    await channel.httpSend("status", { status });
    await admin.removeChannel(channel);
  } catch (e) {
    console.error("notifyGuest failed:", e);
  }
}
