"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

let client: SupabaseClient | undefined;
/** Anonymous Realtime client for guest pages (publishable key; RLS still applies). */
const publicClient = () =>
  (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  }));

/**
 * Re-renders the page's Server Components (router.refresh) when a realtime signal arrives.
 * The signal carries no data we trust: the server re-reads the database. Refreshes are
 * debounced by 1 s, and every re-subscribe after a dropped connection refreshes too.
 */
function useRefreshOn(name: string, listen: (channel: RealtimeChannel, refresh: () => void) => RealtimeChannel) {
  const router = useRouter();
  useEffect(() => {
    const supabase = publicClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1000);
    };
    const channel = listen(supabase.channel(name), refresh).subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (!first) refresh(); // reconnected: catch up on anything missed
      first = false;
    });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // `listen` is a fresh closure each render; the channel only depends on its name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, router]);
}

/** Refresh when the server broadcasts `event` on `channel` (e.g. order status changes). */
export function RefreshOnBroadcast({ channel, event }: { channel: string; event: string }) {
  useRefreshOn(channel, (ch, refresh) => ch.on("broadcast", { event }, refresh));
  return null;
}

/** Refresh when rows of a public table change (e.g. a dish is marked sold out). */
export function RefreshOnTableUpdate({ table }: { table: string }) {
  useRefreshOn(`public:${table}`, (ch, refresh) =>
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table }, refresh),
  );
  return null;
}
