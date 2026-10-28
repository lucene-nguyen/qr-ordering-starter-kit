import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Trusted server client with the secret key – it bypasses RLS. Use it only in Server Actions and
 * server queries, after the code has done its own checks. `server-only` fails the build if a
 * Client Component ever imports this file, so the key cannot reach the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
