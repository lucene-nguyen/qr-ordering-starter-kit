import "server-only";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type TableStatus = "available" | "ordering" | "awaiting" | "paid";

const IDLE_FLAG_MS = 3 * 60 * 60 * 1000; // S1 flags (never closes) tables idle this long – ADR 0003

/**
 * S1 · every table with its open session (if any), read as the signed-in staff member so RLS
 * decides what they see (owner/cashier read sessions, PINs and payments).
 */
export async function getTableBoard() {
  const supabase = await createAuthClient();
  const [tables, sessions] = await Promise.all([
    supabase.from("tables").select("id, code, label").order("code"),
    supabase
      .from("table_sessions")
      .select("id, table_id, pin, opened_at, last_activity_at, session_guests(display_name, joined_at), orders(total, status), payments(amount, status)")
      .eq("status", "open")
      .order("joined_at", { referencedTable: "session_guests" }),
  ]);
  if (tables.error) throw tables.error;
  if (sessions.error) throw sessions.error;

  const now = Date.now();
  return tables.data.map((table) => {
    const s = sessions.data.find((x) => x.table_id === table.id);
    if (!s) return { ...table, status: "available" as TableStatus, session: null };
    const orders = s.orders.filter((o) => o.status !== "cancelled");
    const bill = orders.reduce((n, o) => n + o.total, 0);
    const paid = s.payments.filter((p) => p.status === "confirmed").reduce((n, p) => n + p.amount, 0);
    const status: TableStatus =
      bill > 0 && paid >= bill ? "paid" : s.payments.some((p) => p.status === "pending") ? "awaiting" : "ordering";
    return {
      ...table,
      status,
      session: {
        id: s.id,
        pin: s.pin,
        openedAt: s.opened_at,
        minutesOpen: Math.max(0, Math.round((now - Date.parse(s.opened_at)) / 60_000)),
        idle: now - Date.parse(s.last_activity_at) > IDLE_FLAG_MS,
        guests: s.session_guests.map((g) => g.display_name),
        orders: orders.length,
        bill,
        paid,
        remaining: bill - paid,
      },
    };
  });
}

export type BoardTable = Awaited<ReturnType<typeof getTableBoard>>[number];
