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
 * throttled on the leading edge: the first signal refreshes at once, any further signals within
 * `windowMs` collapse into one refresh at the end of the window. Every re-subscribe after a
 * dropped connection refreshes too.
 */
function useRefreshOn(
  name: string,
  listen: (channel: RealtimeChannel, refresh: () => void) => RealtimeChannel,
  windowMs = 300,
) {
  const router = useRouter();
  useEffect(() => {
    const supabase = publicClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    let first = true;
    const refresh = () => {
      if (timer) return; // a trailing refresh is already scheduled for this window
      const wait = last + windowMs - Date.now();
      if (wait <= 0) {
        last = Date.now();
        router.refresh();
      } else {
        timer = setTimeout(() => {
          timer = undefined;
          last = Date.now();
          router.refresh();
        }, wait);
      }
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
  }, [name, router, windowMs]);
}

/** Refresh when the server broadcasts one of `events` on `channel` (order status, shared cart changes). */
export function RefreshOnBroadcast({ channel, events }: { channel: string; events: string[] }) {
  useRefreshOn(channel, (ch, refresh) => events.reduce((c, event) => c.on("broadcast", { event }, refresh), ch));
  return null;
}

/** Refresh when rows of a public table change (e.g. a dish is marked sold out). */
export function RefreshOnTableUpdate({ table }: { table: string }) {
  useRefreshOn(`public:${table}`, (ch, refresh) =>
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table }, refresh),
  );
  return null;
}
