"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { setGuestCookie } from "./guest";

export type JoinState = { error: string | null };

const input = z.object({ tableCode: z.string().min(1).max(10), name: z.string().max(40) });

/** 00 · Join: open (or reuse) the table's session, add this phone as a guest, remember it. */
export async function joinTable(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = input.safeParse({ tableCode: formData.get("tableCode"), name: formData.get("name") ?? "" });
  if (!parsed.success) return { error: "Please use a shorter name." };
  const { tableCode, name } = parsed.data;

  // shortcut: any phone with the table link can join; Phase 5 requires the session token from the QR.
  const { data, error } = await createAdminClient().rpc("join_table", { p_table_code: tableCode, p_name: name });
  if (error) {
    if (error.message !== "TABLE_NOT_FOUND") console.error("joinTable failed:", error.message);
    return { error: "We couldn't join this table. Please try again or ask our staff." };
  }
  await setGuestCookie(tableCode, (data as { guest_id: string }).guest_id);
  redirect(`/t/${tableCode}`);
}
