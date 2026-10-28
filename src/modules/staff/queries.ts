import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type StaffRole = "owner" | "cashier" | "kitchen";
export type Staff = { userId: string; displayName: string; role: StaffRole };

/** Who may do what. Pages and Server Actions check these; RLS checks again in the database. */
export const CAN = {
  runKitchen: ["owner", "cashier", "kitchen"],
  manageSettings: ["owner"],
} as const satisfies Record<string, readonly StaffRole[]>;

export const allowed = (staff: Staff, roles: readonly StaffRole[]) => roles.includes(staff.role);

/** The signed-in staff member, or null (signed out, or an account without a staff profile). */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("staff_profiles")
    .select("display_name, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { userId, displayName: data.display_name, role: data.role as StaffRole } : null;
}

/** For staff pages and actions: the staff member, or a redirect to sign-in. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/staff/sign-in?error=no-access");
  return staff;
}

/** First page after signing in (the only console page in Phase 3). */
export const STAFF_HOME = "/staff/kitchen";
