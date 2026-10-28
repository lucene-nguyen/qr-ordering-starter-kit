import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Browser client that carries the signed-in staff session (from cookies), so Realtime and reads
 * are filtered by RLS for that staff member. @supabase/ssr returns one shared instance per tab.
 */
export function createBrowserAuthClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
