"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

export type AvailabilityResult = { ok: true } | { ok: false; message: string };

const input = z.object({ itemId: z.uuid(), available: z.boolean() });

/** Kitchen/cashier/owner toggle "sold out today". Guests' open menus refresh via Realtime. */
export async function setDishAvailability(itemId: string, available: boolean): Promise<AvailabilityResult> {
  const parsed = input.safeParse({ itemId, available });
  if (!parsed.success) return { ok: false, message: "Unknown dish." };
  const staff = await requireStaff();
  if (!allowed(staff, CAN.markSoldOut)) return { ok: false, message: "Your role can't change the menu." };

  // As the staff member: RLS checks the role again, the column grant allows only is_available.
  const { data, error } = await (await createAuthClient())
    .from("menu_items")
    .update({ is_available: parsed.data.available })
    .eq("id", parsed.data.itemId)
    .select("id");
  if (error || !data.length) {
    if (error) console.error("setDishAvailability failed:", error.message);
    return { ok: false, message: "Couldn't update the dish. Try again." };
  }

  revalidatePath("/t/[tableId]", "layout"); // every guest menu and item page renders fresh next time
  return { ok: true };
}
