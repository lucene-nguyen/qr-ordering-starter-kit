"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { setGuestCookie } from "./guest";

export type JoinState = { error: string | null };

const input = z.object({
  tableCode: z.string().min(1).max(10),
  name: z.string().max(40),
  pin: z.string().regex(/^[0-9]{4}$/),
});

/** 00 · Join: needs the PIN of the table's open session (staff read it out, ADR 0003). */
export async function joinTable(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = input.safeParse({
    tableCode: formData.get("tableCode"),
    name: formData.get("name") ?? "",
    pin: formData.get("pin") ?? "",
  });
  if (!parsed.success) return { error: "Enter the 4-digit table PIN from our staff." };
  const { tableCode, name, pin } = parsed.data;

  // Wrong PINs are limited per (IP + table). On Vercel the edge sets x-forwarded-for, so the first
  // address is the guest's; locally anyone can send this header.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const { data, error } = await createAdminClient().rpc("join_table", {
    p_table_code: tableCode,
    p_name: name,
    p_pin: pin,
    p_ip: ip,
  });
  if (error) {
    if (error.message === "TABLE_CLOSED") return { error: "This table isn't open yet. Please ask our staff." };
    if (error.message === "TOO_MANY_TRIES") return { error: "Too many tries. Ask our staff for the PIN." };
    if (error.message !== "TABLE_NOT_FOUND") console.error("joinTable failed:", error.message);
    return { error: "We couldn't join this table. Please try again or ask our staff." };
  }
  const result = data as { guest_id?: string; error?: "WRONG_PIN"; tries_left?: number };
  if (result.error === "WRONG_PIN") {
    const left = result.tries_left ?? 0;
    return { error: left > 0 ? `Wrong PIN – ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many tries. Ask our staff for the PIN." };
  }
  await setGuestCookie(tableCode, result.guest_id!);
  redirect(`/t/${tableCode}`);
}
