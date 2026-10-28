import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { guestIdFromCookie } from "@/modules/table-session/guest";
import { splitEvenly } from "./split";

const confirmed = (payments: { amount: number; status: string }[]) =>
  payments.filter((p) => p.status === "confirmed").reduce((n, p) => n + p.amount, 0);
const billOf = (orders: { total: number; status: string }[]) =>
  orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0);

/**
 * 05 · what this guest could pay right now, as a PREVIEW only: request_payment computes the real
 * amount in the database. Callers have checked the guest cookie (getGuest).
 */
export async function getPayOptions(sessionId: string, guestId: string, people: number) {
  const { data, error } = await createAdminClient()
    .from("table_sessions")
    .select("split_people, orders(total, status), payments(id, guest_id, amount, kind, status)")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  const pending = data.payments.filter((p) => p.status === "pending");
  // Still to pay = bill − confirmed − requests other guests are paying right now (as in the DB).
  const open = billOf(data.orders) - confirmed(data.payments) - pending.reduce((n, p) => n + p.amount, 0);
  const splitPeople = data.split_people ?? people; // the first guest who splits fixes the number
  const sharesTaken = data.payments.filter((p) => p.kind === "share" && p.status !== "cancelled").length;
  const unpaid = splitPeople - sharesTaken;
  return {
    bill: billOf(data.orders),
    open,
    pendingId: pending.find((p) => p.guest_id === guestId)?.id ?? null, // this phone's open request
    splitFixed: data.split_people !== null,
    splitPeople,
    share: open <= 0 ? 0 : unpaid <= 1 ? open : unpaid * 1000 > open ? null : splitEvenly(open, unpaid)[0],
  };
}

/**
 * One payment of the guest on this phone (by the tt_guest cookie), with how the table's bill
 * stands. Works after the session closed too, so a guest who paid still sees 06 · Paid.
 */
export async function getMyPayment(tableCode: string, paymentId: string) {
  const guestId = await guestIdFromCookie();
  if (!guestId || !z.uuid().safeParse(paymentId).success) return null;
  const { data, error } = await createAdminClient()
    .from("payments")
    .select(
      "id, session_id, amount, kind, method, status, confirmed_at, table_sessions!inner(status, tables!inner(code, label), orders(total, status), payments(amount, status))",
    )
    .eq("id", paymentId)
    .eq("guest_id", guestId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.table_sessions.tables.code !== tableCode) return null;
  const s = data.table_sessions;
  return {
    id: data.id,
    sessionId: data.session_id,
    sessionOpen: s.status === "open",
    tableLabel: s.tables.label,
    amount: data.amount,
    kind: data.kind,
    status: data.status,
    confirmedAt: data.confirmed_at,
    settled: billOf(s.orders) - confirmed(s.payments) <= 0,
  };
}

/**
 * What the guest's QR needs, from guest_payment_qr with the PUBLISHABLE key (never the secret key):
 * the database only answers for this phone's own pending payment in an open session. Null when it
 * isn't one (any more); `bin` etc. are null while the restaurant has no bank details.
 */
export async function getPaymentQr(tableCode: string, paymentId: string) {
  const guestId = await guestIdFromCookie();
  if (!guestId) return null;
  const { data, error } = await createSupabaseClient()
    .rpc("guest_payment_qr", { p_table_code: tableCode, p_guest: guestId, p_payment: paymentId })
    .maybeSingle();
  if (error) {
    if (error.message === "NOT_FOUND") return null;
    throw error;
  }
  if (!data) return null;
  return {
    amount: data.amount,
    reference: data.reference,
    // Generated types say string; a missing settings row gives null (left join).
    bank: data.bin && data.account_no ? { bin: data.bin, accountNo: data.account_no, accountName: data.account_name } : null,
  };
}

/** C2 · one open session's bill (every item of every round) and payments, read as the staff member. */
export async function getCheckout(sessionId: string) {
  const { data, error } = await (await createAuthClient())
    .from("table_sessions")
    .select(
      "id, orders(status, created_at, order_items(id, name_snapshot, size_name, addons, unit_price, qty)), payments(id, payer_name, kind, amount, method, status, reference, created_at, confirmed_at)",
    )
    .eq("id", sessionId)
    .eq("status", "open")
    .order("created_at", { referencedTable: "orders" })
    .order("created_at", { referencedTable: "payments" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const orders = data.orders.filter((o) => o.status !== "cancelled");
  return {
    lines: orders.flatMap((o) =>
      o.order_items.map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        options: [i.size_name, ...(i.addons as { name: string }[]).map((a) => a.name)].filter(Boolean).join(" · "),
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
    ),
    payments: data.payments.filter((p) => p.status !== "cancelled"),
  };
}
