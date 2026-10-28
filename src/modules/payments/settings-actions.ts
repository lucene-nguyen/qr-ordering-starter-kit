"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writesBlocked } from "@/lib/db-env";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";
import { accountHolder, BANKS } from "./banks";

type Values = { name: string; bin: string; accountNo: string; accountName: string };
// `values` refill the form: React resets a form after its action runs.
export type SettingsState = { error: string | null; saved?: boolean; values?: Values };

const input = z.object({
  name: z.string().trim().min(1, "Enter the restaurant name.").max(60, "Keep the restaurant name under 60 characters."),
  bin: z.enum(BANKS.map((b) => b.bin) as [string, ...string[]], { error: "Choose a bank." }),
  accountNo: z.string().transform((s) => s.replace(/\s/g, "")).pipe(z.string().regex(/^[0-9]{6,19}$/, "The account number is 6–19 digits.")),
  accountName: z
    .string()
    .transform(accountHolder)
    .pipe(z.string().regex(/^[A-Z0-9 ]{1,50}$/, "Use the account holder name as the bank prints it (letters, digits, spaces).")),
});

/**
 * O3 · Save the bank account guests pay into. Owner only – checked here and again by RLS and the
 * column grants; the database also checks every format. New VietQR codes use it at once.
 */
export async function saveBankDetails(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const blocked = writesBlocked(); // Preview pointing at the prod database: refuse to write
  const values = Object.fromEntries(["name", "bin", "accountNo", "accountName"].map((k) => [k, String(formData.get(k) ?? "")])) as Values;
  if (blocked) return { error: blocked, values };
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageSettings)) return { error: "Only the owner can change bank details.", values };

  const parsed = input.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, values };
  const row = { name: parsed.data.name, bank_bin: parsed.data.bin, account_no: parsed.data.accountNo, account_name: parsed.data.accountName };

  const supabase = await createAuthClient();
  // One row (id = 1): update it, or add it the first time (no placeholder row exists).
  const updated = await supabase.from("restaurant_settings").update(row).eq("id", 1).select("id");
  const { error } = updated.error || updated.data.length ? updated : await supabase.from("restaurant_settings").insert(row);
  if (error) {
    console.error("saveBankDetails failed:", error.message);
    return { error: "Couldn't save the bank details. Check the fields and try again.", values };
  }
  revalidatePath("/staff/settings");
  return { error: null, saved: true, values: parsed.data };
}
