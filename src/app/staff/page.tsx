import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/staff/queries";

// Staff home: each role lands on the screen it works in.
export default async function StaffHome() {
  const staff = await requireStaff();
  redirect(staff.role === "kitchen" ? "/staff/kitchen" : "/staff/tables");
}
