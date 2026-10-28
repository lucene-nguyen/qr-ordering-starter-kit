import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "@/lib/db-env";

/**
 * Anonymous, read-only client for Server Components. Uses the publishable key, so Row Level
 * Security decides what is visible – the same rules a guest's browser would get.
 * shortcut: no auth cookies; move to @supabase/ssr when staff sign-in lands (Phase 5).
 */
export function createSupabaseClient() {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false } },
  );
}
