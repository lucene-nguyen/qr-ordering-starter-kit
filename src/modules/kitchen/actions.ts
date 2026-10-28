"use server";

import { z } from "zod";
import { broadcast } from "@/lib/realtime-notify";
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

  // The guest's status page re-reads the order when it hears this (a forged message can't fake a status).
  await broadcast(`order:${orderId}`, "status", { status: to });
  return { ok: true, status: to };
}
