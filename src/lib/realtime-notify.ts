import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server → browsers signal over Realtime Broadcast, sent over HTTP (no WebSocket from a Server
 * Action). Receivers treat it as "re-read now", never as data (ADR 0002). A failure is only
 * logged: the write it announces has already happened, and receivers resync on reconnect anyway.
 */
export async function broadcast(channel: string, event: string, payload: Record<string, unknown> = {}) {
  try {
    const admin = createAdminClient();
    const ch = admin.channel(channel);
    await ch.httpSend(event, payload);
    await admin.removeChannel(ch);
  } catch (e) {
    console.error(`broadcast on ${channel} failed:`, e);
  }
}
