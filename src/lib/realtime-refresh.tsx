"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserAuthClient } from "@/lib/supabase/auth-browser";

/**
 * Leading-edge throttle: the first call runs at once, further calls within `windowMs` collapse
 * into one trailing call at the end of the window.
 */
function throttle(fn: () => void, windowMs = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  return {
    run() {
      if (timer) return; // a trailing call is already scheduled for this window
      const wait = last + windowMs - Date.now();
      if (wait <= 0) {
        last = Date.now();
        fn();
      } else {
        timer = setTimeout(() => {
          timer = undefined;
          last = Date.now();
          fn();
        }, wait);
      }
    },
    cancel: () => clearTimeout(timer),
  };
}

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
    const refresh = throttle(() => router.refresh(), windowMs);
    let first = true;
    const channel = listen(supabase.channel(name), refresh.run).subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (!first) refresh.run(); // reconnected: catch up on anything missed
      first = false;
    });
    return () => {
      refresh.cancel();
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

/**
 * Staff screens: refresh when rows of these tables change. The socket must join with the staff
 * JWT, not anon, or RLS silently drops every event (Phase 3 lesson), so the session's token is
 * handed to Realtime before subscribing and again whenever it is refreshed.
 */
export function RefreshOnStaffChanges({ tables }: { tables: string[] }) {
  const router = useRouter();
  const key = tables.join(",");
  useEffect(() => {
    const supabase = createBrowserAuthClient();
    const refresh = throttle(() => router.refresh());
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && session) {
        void supabase.realtime.setAuth(session.access_token);
      }
    });
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      let first = true;
      channel = key
        .split(",")
        .reduce((ch, table) => ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh.run), supabase.channel(`staff:${key}`))
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          if (!first) refresh.run(); // reconnected: catch up on anything missed
          first = false;
        });
    })();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      refresh.cancel();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, router]);
  return null;
}

/** Refresh when rows of a public table change (e.g. a dish is marked sold out). */
export function RefreshOnTableUpdate({ table }: { table: string }) {
  useRefreshOn(`public:${table}`, (ch, refresh) =>
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table }, refresh),
  );
  return null;
}
