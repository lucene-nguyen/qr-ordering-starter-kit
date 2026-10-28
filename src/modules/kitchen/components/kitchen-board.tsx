"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Icon } from "@/lib/icons";
import { createBrowserAuthClient } from "@/lib/supabase/auth-browser";
import { setDishAvailability } from "@/modules/menu/actions";
import { SignOutButton } from "@/modules/staff/components/sign-out-button";
import { advanceOrder } from "../actions";
import { fetchOpenOrders, fetchOrder, OPEN_STATUSES, type KitchenOrder } from "../queries";
import { SoldOutDrawer, type DishAvailability } from "./sold-out-drawer";

type Conn = "on" | "off" | "back";

const COLUMNS = [
  { status: "pending", title: "New", count: "bg-surface-brand text-brand-strong", action: "Start preparing", empty: "No new orders. New tickets pop in here with a sound." },
  { status: "preparing", title: "Preparing", count: "bg-dark text-white", action: "Mark ready", empty: "Nothing cooking right now." },
  { status: "ready", title: "Ready to serve", count: "bg-success-surface text-success", action: "Mark served", empty: "Nothing waiting to be served." },
] as const;

const LATE_MINUTES = 10;
const ghost = "flex items-center gap-2 rounded-sm border border-white/30 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-white/10";

const FRESH_MS = 5000;

/** Two short tones made with WebAudio – no sound file to load. */
function chime(ctx: AudioContext, volume = 0.25) {
  [880, 1175].forEach((hz, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    const at = ctx.currentTime + i * 0.18;
    osc.start(at);
    osc.stop(at + 0.14);
  });
}

const isOpen = (o: KitchenOrder) => OPEN_STATUSES.includes(o.status);
const byId = (list: KitchenOrder[]) => new Map(list.map((o) => [o.id, o]));

// The current time, ticking every 30 s. Null on the server/hydration so markup always matches.
const TICK = 30_000;
const subscribeTick = (cb: () => void) => {
  const t = setInterval(cb, TICK);
  return () => clearInterval(t);
};
const useNow = () =>
  useSyncExternalStore(subscribeTick, () => Math.floor(Date.now() / TICK) * TICK, () => null);

/** K1 · Kitchen display, K1b · offline/resync, and the sold-out drawer. */
export function KitchenBoard({
  initialOrders,
  initialDishes,
  timeZone,
}: {
  initialOrders: KitchenOrder[];
  initialDishes: DishAvailability[];
  timeZone: string;
}) {
  const [orders, setOrders] = useState(() => byId(initialOrders));
  const [dishes, setDishes] = useState(initialDishes);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conn, setConn] = useState<Conn>("on");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const now = useNow();
  const [notice, setNotice] = useState<string | null>(null);
  const [shiftStarted, setShiftStarted] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const resyncRef = useRef<() => Promise<boolean>>(async () => false);
  const hhmm = (ms: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(ms);

  const upsert = useCallback((order: KitchenOrder) => {
    setOrders((prev) => {
      const next = new Map(prev);
      if (isOpen(order)) next.set(order.id, order);
      else next.delete(order.id); // served/cancelled leave the board
      return next;
    });
  }, []);

  // New ticket: sound (once the shift has unlocked audio) and a highlight for a few seconds.
  const announce = useCallback((id: string) => {
    if (audioRef.current) chime(audioRef.current);
    setFresh((s) => new Set(s).add(id));
    setTimeout(() => setFresh((s) => new Set([...s].filter((x) => x !== id))), FRESH_MS);
  }, []);

  // Browsers only allow sound after a tap on the page: "Start shift" is that tap.
  const startShift = () => {
    const ctx = new AudioContext();
    void ctx.resume();
    chime(ctx, 0.02); // near-silent, proves audio works without startling anyone
    audioRef.current = ctx;
    setShiftStarted(true);
  };

  useEffect(() => {
    const supabase = createBrowserAuthClient();

    // The database is the source of truth: replace the board with every open order.
    const resync = async () => {
      try {
        setOrders(byId(await fetchOpenOrders(supabase)));
        setSyncedAt(Date.now());
        return true;
      } catch {
        setConn("off");
        return false;
      }
    };
    resyncRef.current = resync;

    const channel = supabase
      .channel("kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async (payload) => {
        const id = (payload.new as { id?: string }).id;
        if (!id) return;
        const order = await fetchOrder(supabase, id).catch(() => null); // with its items
        if (!order) return;
        upsert(order);
        if (payload.eventType === "INSERT" && isOpen(order)) announce(order.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (payload) => {
        const { id, is_available } = payload.new as DishAvailability; // sold-out toggled on another screen
        setDishes((list) => list.map((d) => (d.id === id ? { ...d, is_available } : d)));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void resync(); // first join and every reconnect: catch up on anything missed
          setConn((c) => (c === "off" ? "back" : "on"));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConn("off");
        }
      });

    const offline = () => setConn("off");
    // Network back but the socket never dropped (so no new SUBSCRIBED): resync ourselves.
    const online = () => void resync().then((ok) => ok && setConn((c) => (c === "off" ? "back" : c)));
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      void supabase.removeChannel(channel);
    };
  }, [upsert, announce]);

  useEffect(() => {
    if (conn !== "back") return;
    const t = setTimeout(() => setConn("on"), 3500);
    return () => clearTimeout(t);
  }, [conn]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const toggleDish = async (dish: DishAvailability) => {
    const set = (is_available: boolean) =>
      setDishes((list) => list.map((d) => (d.id === dish.id ? { ...d, is_available } : d)));
    set(!dish.is_available); // optimistic; undone below if the server says no
    const result = await setDishAvailability(dish.id, !dish.is_available).catch(() => ({
      ok: false as const,
      message: "Couldn't reach the server. Check the connection.",
    }));
    if (!result.ok) {
      set(dish.is_available);
      setNotice(result.message);
    }
  };
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const list = [...orders.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const offline = conn === "off";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-4 bg-dark px-6 py-3.5 text-white">
        <Icon name="flame" size={24} />
        <div className="flex-1">
          <h1 className="text-title">Kitchen Display</h1>
          <p className="text-caption opacity-65">Updates instantly via Supabase Realtime</p>
        </div>
        <span className="flex items-center gap-2 text-[13px]" role="status">
          <span className={`size-2 rounded-full ${offline ? "bg-brand" : "bg-success"}`} />
          {offline ? "Reconnecting…" : "Connected"}
        </span>
        <button type="button" onClick={() => setDrawerOpen(true)} className={ghost}>
          <Icon name="ban" size={16} /> Mark sold out
        </button>
        <span className="text-heading flex items-center gap-2 tabular-nums">
          <Icon name="clock" size={16} /> {now && hhmm(now)}
        </span>
        <SignOutButton className={ghost} />
      </header>

      {conn === "off" && (
        <div role="alert" className="flex items-center gap-2 bg-surface-brand px-6 py-2.5 text-[13px] text-brand-strong">
          <Icon name="wifiOff" size={18} />
          <span className="flex-1">
            <b>Connection lost.</b> Reconnecting… Showing orders{" "}
            {syncedAt ? `synced at ${hhmm(syncedAt)}` : "loaded with the page"}. New orders will appear once
            we&apos;re back.
          </span>
          <button
            type="button"
            onClick={() => void resyncRef.current().then((ok) => ok && setConn((c) => (c === "off" ? "back" : c)))}
            className="h-[42px] rounded-md border border-border bg-bg px-4 font-semibold text-text hover:bg-surface"
          >
            Retry now
          </button>
        </div>
      )}
      {conn === "back" && (
        <div role="status" className="flex items-center gap-2 bg-success-surface px-6 py-2.5 text-[13px] text-success">
          <Icon name="checkCircle" size={18} /> Back online · resynced, nothing was missed.
        </div>
      )}

      <div className="grid flex-1 gap-4 px-6 py-5 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const tickets = list.filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title} className="flex flex-col gap-3 rounded-lg bg-surface p-3">
              <div className="flex items-center gap-2 p-1">
                <h2 className="text-heading">{col.title}</h2>
                <span className={`text-caption rounded-full px-2.5 py-0.5 ${col.count}`}>{tickets.length}</span>
              </div>
              {tickets.length === 0 ? (
                <p className="text-caption px-3 py-7 text-center text-muted">{col.empty}</p>
              ) : (
                tickets.map((o) => (
                  <Ticket
                    key={o.id}
                    order={o}
                    action={col.action}
                    now={now}
                    fresh={fresh.has(o.id)}
                    disabled={offline}
                    onAdvanced={(status) => upsert({ ...o, status })}
                    onError={(message) => {
                      setNotice(message);
                      void resyncRef.current();
                    }}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      {!shiftStarted && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-dark/80 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="shift-title" className="flex max-w-sm flex-col items-center gap-4 rounded-lg bg-bg p-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-brand text-white">
              <Icon name="bell" size={26} />
            </span>
            <h2 id="shift-title" className="text-display">Ready for service?</h2>
            <p className="text-muted">Tap Start shift so this tablet can play a sound when a new order arrives.</p>
            <button type="button" autoFocus onClick={startShift} className="h-[52px] w-full rounded-md bg-brand font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              Start shift
            </button>
          </div>
        </div>
      )}

      {drawerOpen && <SoldOutDrawer dishes={dishes} onToggle={toggleDish} onClose={closeDrawer} />}

      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-dark px-4 py-3 text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}

function Ticket({
  order,
  action,
  now,
  fresh,
  disabled,
  onAdvanced,
  onError,
}: {
  order: KitchenOrder;
  action: string;
  now: number | null;
  fresh: boolean;
  disabled: boolean;
  onAdvanced: (status: KitchenOrder["status"]) => void;
  onError: (message: string) => void;
}) {
  const [pending, start] = useTransition();
  const minutes = now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(order.created_at)) / 60_000));
  const ready = order.status === "ready";
  const late = minutes >= LATE_MINUTES && !ready;
  const age = ready ? "Ready" : now === null ? "" : minutes < 1 ? "Just now" : `${minutes} min`;
  const agePill = late ? "bg-surface-brand text-brand-strong" : ready ? "bg-success-surface text-success" : "bg-surface text-muted";

  function advance() {
    start(async () => {
      try {
        const result = await advanceOrder(order.id, order.status as "pending" | "preparing" | "ready");
        if (result.ok) onAdvanced(result.status);
        else onError(result.message);
      } catch {
        onError("Couldn't reach the server. Check the connection.");
      }
    });
  }

  return (
    <article
      className={`overflow-hidden rounded-md bg-bg transition-shadow ${late ? "border-2 border-brand" : "border border-border"} ${
        fresh ? "ring-4 ring-brand/40" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-title">{order.tables.label}</span>
        <span className="text-caption text-muted">#{order.order_no}</span>
        <span className="flex-1" />
        <span className={`text-caption rounded-full px-2.5 py-0.5 ${agePill}`}>{age}</span>
      </div>
      <ul className="flex flex-col gap-2 px-4 pb-3">
        {order.order_items.map((item) => {
          const addons = (item.addons as { name: string }[]).map((a) => a.name);
          const options = [item.size_name, ...addons].filter(Boolean).join(" · ");
          return (
            <li key={item.id} className="grid grid-cols-[28px_1fr] gap-1.5">
              <span className="text-heading text-brand-strong">{item.qty}×</span>
              <div>
                <p className="text-heading">{item.name_snapshot}</p>
                {options && <p className="text-caption text-muted">{options}</p>}
                {item.note && (
                  <span className="mt-0.5 inline-block rounded-[4px] bg-surface-brand px-2 py-0.5 text-[12px] text-brand-strong">
                    Note: {item.note}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={advance}
          disabled={disabled || pending}
          className={`h-[42px] w-full rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            ready ? "border border-border bg-bg hover:bg-surface" : "bg-brand text-white hover:bg-brand-strong"
          }`}
        >
          {pending ? "Saving…" : action}
        </button>
      </div>
    </article>
  );
}
