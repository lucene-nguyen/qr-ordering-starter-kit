import "server-only";
import { databaseTarget } from "./db-target";

/** A required environment variable, or an error that names it (the value is never printed). */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} – set it in .env.local / Vercel.`);
  return value;
}

/** Which Supabase project this deployment talks to (from the public URL only – never a key). */
export const databaseInfo = () => databaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VERCEL_ENV);

/** Why writes are refused on this deployment, or null. Every Server Action that writes checks it. */
export function writesBlocked(): string | null {
  return databaseInfo().misconfigured
    ? "This Preview is pointing at the PRODUCTION database, so changes are blocked. Fix the Preview environment variables on Vercel."
    : null;
}
