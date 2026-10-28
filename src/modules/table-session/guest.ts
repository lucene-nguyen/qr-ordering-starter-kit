import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who the guest is: the httpOnly `tt_guest` cookie holds their session_guests id. It is the only
 * guest credential – a session id alone never is. Scoped to /t/<code>, so each table has its own.
 */
const GUEST_COOKIE = "tt_guest";

export type Guest = { guestId: string; displayName: string; sessionId: string };
type Table = { id: string; code: string };

/** The guest of this table's open session, or null (not joined, other table, or staff closed it). */
export async function getGuest(table: Table): Promise<Guest | null> {
  const id = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!id || !z.uuid().safeParse(id).success) return null;
  const { data, error } = await createAdminClient()
    .from("session_guests")
    .select("id, display_name, table_sessions!inner(id, table_id, status)")
    .eq("id", id)
    .maybeSingle();
  // A failed query is not "no guest": treating it as one hid a misconfigured deployment (wrong DB/key).
  if (error) throw error;
  const s = data?.table_sessions;
  if (!data || !s || s.table_id !== table.id || s.status !== "open") return null;
  return { guestId: data.id, displayName: data.display_name, sessionId: s.id };
}

/** True when this phone still carries a guest cookie for the table (it may belong to a closed session). */
export async function hasGuestCookie() {
  return (await cookies()).has(GUEST_COOKIE);
}

/** Forget this phone's guest at a table, e.g. after staff closed its session. */
export async function clearGuestCookie(tableCode: string) {
  (await cookies()).delete({ name: GUEST_COOKIE, path: `/t/${tableCode}` });
}

/**
 * The value is the session_guests id, and every guest row belongs to exactly one session, so the
 * cookie is tied to that session: once staff close it, the cookie stops working everywhere.
 */
export async function setGuestCookie(tableCode: string, guestId: string) {
  (await cookies()).set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/t/${tableCode}`,
    maxAge: 12 * 60 * 60,
  });
}

/** The table's open session and who is in it, for the join screen. Null if staff haven't opened it. */
export async function getOpenSession(tableId: string) {
  const { data, error } = await createAdminClient()
    .from("table_sessions")
    .select("id, opened_at, session_guests(display_name, joined_at)")
    .eq("table_id", tableId)
    .eq("status", "open")
    .order("joined_at", { referencedTable: "session_guests" })
    .maybeSingle();
  if (error) throw error; // never show "table isn't open" because the query itself failed
  if (!data) return null;
  return { openedAt: data.opened_at, guestNames: data.session_guests.map((g) => g.display_name) };
}
