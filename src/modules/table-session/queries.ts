import { createSupabaseClient } from "@/lib/supabase/server";

/** Table by the code printed in its QR (`/t/05` → '05'). Inactive tables are hidden by RLS. */
export async function getTableByCode(code: string) {
  const { data, error } = await createSupabaseClient()
    .from("tables")
    .select("id, code, label")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTables() {
  const { data, error } = await createSupabaseClient()
    .from("tables")
    .select("id, code, label")
    .order("code");
  if (error) throw error;
  return data;
}

/** The URL a table's QR points to, on the site that is serving the request (`origin`). */
export function tableUrl(code: string, origin: string) {
  return new URL(`/t/${encodeURIComponent(code)}`, origin).toString();
}
