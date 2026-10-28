import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { env } from "@/lib/db-env";

/**
 * Client acting as the signed-in staff member (session in cookies), so RLS applies to them.
 * Create one per request. For Server Components, Server Actions and Route Handlers.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {} // Server Components cannot set cookies; src/proxy.ts refreshes the session instead
        },
      },
    },
  );
}
