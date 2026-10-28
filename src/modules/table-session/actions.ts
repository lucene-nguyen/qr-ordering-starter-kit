"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearGuestCookie, setGuestCookie } from "./guest";

export type JoinState = { error: string | null; name?: string };

const tableCode = z.string().min(1).max(10);
const input = z.object({ tableCode, name: z.string().max(40), pin: z.string().regex(/^[0-9]{4}$/) });

/**
 * The guest's IP for the wrong-PIN limit – always from the server's request headers, never from
 * the client. On Vercel `x-real-ip` (or the first `x-forwarded-for` hop) is set by Vercel's edge;
 * locally there is no proxy, so every local guest counts as "local".
 */
async function guestIp() {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** 00 · Join: needs the PIN of the table's open session (staff read it out, ADR 0003). */
export async function joinTable(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const name = String(formData.get("name") ?? "");
  const parsed = input.safeParse({ tableCode: formData.get("tableCode"), name, pin: formData.get("pin") ?? "" });
  if (!parsed.success) return { error: "Enter the 4-digit table PIN from our staff.", name };
  const { tableCode: code, pin } = parsed.data;

  const { data, error } = await createAdminClient().rpc("join_table", {
    p_table_code: code,
    p_name: parsed.data.name,
    p_pin: pin,
    p_ip: await guestIp(),
  });
  if (error) {
    if (error.message === "TABLE_CLOSED") redirect(`/t/${code}`); // the menu page shows 00b
    // One message for every lock: guests don't learn whether it was per phone or per table.
    if (error.message === "TOO_MANY_TRIES") return { error: "Too many tries, ask staff", name };
    if (error.message !== "TABLE_NOT_FOUND") console.error("joinTable failed:", error.message);
    return { error: "We couldn't join this table. Please try again or ask our staff.", name };
  }
  const result = data as { guest_id?: string; error?: "WRONG_PIN"; tries_left?: number };
  if (result.error === "WRONG_PIN") {
    const left = result.tries_left ?? 0;
    return { error: left > 0 ? `Wrong PIN, ${left} ${left === 1 ? "try" : "tries"} left` : "Too many tries, ask staff", name };
  }
  await setGuestCookie(code, result.guest_id!);
  redirect(`/t/${code}`);
}

/** Drops a guest cookie whose session staff have closed (Server Components can't delete cookies). */
export async function forgetGuest(code: string) {
  if (tableCode.safeParse(code).success) await clearGuestCookie(code);
}
