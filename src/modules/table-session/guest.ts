import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who the guest is: the httpOnly `tt_guest` cookie holds their session_guests id. It is the only
 * guest credential – a session id alone never is. Scoped to /t/<code>, so each table has its own.
 */
const GUEST_COOKIE = "tt_guest";
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000; // keep in sync with private.guest_session (4 hours)

export type Guest = { guestId: string; displayName: string; sessionId: string };
type Table = { id: string; code: string };

const isFresh = (lastActivityAt: string) => Date.parse(lastActivityAt) > Date.now() - IDLE_LIMIT_MS;

/** The guest of this table's open session, or null (not joined, other table, closed or idle). */
export async function getGuest(table: Table): Promise<Guest | null> {
  const id = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!id || !z.uuid().safeParse(id).success) return null;
  const { data } = await createAdminClient()
    .from("session_guests")
    .select("id, display_name, table_sessions!inner(id, table_id, status, last_activity_at)")
    .eq("id", id)
    .maybeSingle();
  const s = data?.table_sessions;
  if (!data || !s || s.table_id !== table.id || s.status !== "open" || !isFresh(s.last_activity_at)) return null;
  return { guestId: data.id, displayName: data.display_name, sessionId: s.id };
}

export async function setGuestCookie(tableCode: string, guestId: string) {
  (await cookies()).set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/t/${tableCode}`,
    maxAge: 12 * 60 * 60,
  });
}

/** The table's open session and who is in it, for the join screen. Null if none (or idle). */
export async function getOpenSession(tableId: string) {
  const { data } = await createAdminClient()
    .from("table_sessions")
    .select("id, opened_at, last_activity_at, session_guests(display_name, joined_at)")
    .eq("table_id", tableId)
    .eq("status", "open")
    .order("joined_at", { referencedTable: "session_guests" })
    .maybeSingle();
  if (!data || !isFresh(data.last_activity_at)) return null;
  return { openedAt: data.opened_at, guestNames: data.session_guests.map((g) => g.display_name) };
}
