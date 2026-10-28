"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { DishPhoto } from "@/modules/menu/components/dish-row";
import { changeQty, placeRound } from "../actions";
import type { SessionCart } from "../queries";
import { cartTotal, type SharedCartLine } from "../types";
import { PageNav } from "./page-nav";
import { Stepper } from "./stepper";

const OFFLINE = "Check your connection and try again. Your cart is saved for the whole table.";

/** "Lan and Minh", "Lan, Minh and Hoa", "Lan, Minh and 3 others". */
function listNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

/** Applies a +/− to the lines on screen before the server answers. */
function withDelta(lines: SharedCartLine[], { id, delta }: { id: string; delta: number }) {
  return lines.flatMap((l) => (l.id !== id ? [l] : l.qty + delta > 0 ? [{ ...l, qty: Math.min(l.qty + delta, 50) }] : []));
}

/** 03 · Shared cart (+ 03b failure banner). The server's `cart` is the truth; +/− show optimistically. */
export function CartView({ tableCode, tableLabel, cart }: { tableCode: string; tableLabel: string; cart: SessionCart }) {
  const router = useRouter();
  // Optimistic copy of the lines: it shows +/− instantly and falls back to `cart.lines` (fresh from
  // the server via revalidatePath) when the action ends – or back to the old lines if it failed.
  const [lines, applyDelta] = useOptimistic(cart.lines, withDelta);
  const [changing, startChange] = useTransition();
  const [placing, startPlace] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const menu = `/t/${tableCode}`;

  if (placed) return null; // on the way to the status screen

  const nav = <PageNav back={menu} title="Your order" subtitle={`${tableLabel} · Shared cart`} />;
  if (!lines.length) {
    return (
      <>
        {nav}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid size-22 place-items-center rounded-full bg-surface text-muted">
            <Icon name="bag" size={36} />
          </div>
          <p className="text-title">Your cart is empty</p>
          <p className="text-muted">Add a few dishes and they&apos;ll show up here for everyone at the table.</p>
        </div>
        <div className="px-4 pt-3.5 pb-7">
          <Link href={menu} className="flex h-[52px] items-center justify-center rounded-md border border-border font-semibold hover:bg-surface">
            Browse the menu
          </Link>
        </div>
      </>
    );
  }

  const round = cartTotal(lines);

  function change(id: string, delta: number) {
    setError(null);
    setPlaceNote(null);
    startChange(async () => {
      applyDelta({ id, delta });
      try {
        const result = await changeQty(tableCode, id, delta);
        if (!result.ok) setError(result.message); // optimistic value is dropped: back to the real cart
      } catch {
        setError(OFFLINE);
      }
    });
  }

  function place() {
    setError(null);
    setPlaceNote(null);
    startPlace(async () => {
      try {
        const result = await placeRound(tableCode, cart.cartVersion);
        if (!result.ok) {
          if (result.cartChanged) setPlaceNote(result.message); // cart was refreshed by the action
          else setError(result.message);
          return;
        }
        setPlaced(true);
        const sentBy = result.sentBy ? `?sent_by=${encodeURIComponent(result.sentBy)}` : "";
        router.push(`/t/${tableCode}/order/${result.orderId}${sentBy}`);
      } catch {
        setError(OFFLINE);
      }
    });
  }

  return (
    <>
      {nav}
      <div className="flex-1">
        {error ? (
          <div role="alert" className="mx-4 my-2 flex gap-3 rounded-md bg-danger-surface p-3 text-danger">
            <Icon name="wifiOff" size={20} />
            <div>
              <p className="font-semibold">We couldn&apos;t update the order</p>
              <p className="text-caption">{error}</p>
            </div>
          </div>
        ) : (
          cart.others.length > 0 && (
            <div className="mx-4 my-2 flex items-start gap-3 rounded-md bg-surface-brand p-3">
              <Icon name="users" size={20} />
              <div>
                <p className="font-semibold">{listNames([cart.me, ...cart.others])} are ordering together</p>
                <p className="text-caption text-muted">Items sync live across everyone&apos;s phones</p>
              </div>
            </div>
          )
        )}

        <ul>
          {lines.map((l) => (
            <li key={l.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
              <DishPhoto size={56} className="size-14 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">{l.name}</span>
                <span className="text-caption text-muted">{l.options || "Standard"}</span>
                {l.note && <span className="text-caption text-brand-strong">Note: {l.note}</span>}
                <span className="text-caption text-muted">Added by {l.addedBy}</span>
              </div>
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-semibold tabular-nums">{formatVnd(l.unitPrice * l.qty)}</span>
                <Stepper value={l.qty} min={0} onChange={(q) => change(l.id, q - l.qty)} label={l.name} />
              </div>
            </li>
          ))}
        </ul>

        <Link href={menu} className="flex items-center gap-2 p-4 font-semibold text-brand-strong">
          <Icon name="plus" /> Add more items
        </Link>

        <dl className="flex flex-col gap-2 px-4 py-2">
          {cart.alreadyOrdered > 0 && (
            <div className="flex text-muted">
              <dt className="flex-1">Already ordered</dt>
              <dd className="tabular-nums">{formatVnd(cart.alreadyOrdered)}</dd>
            </div>
          )}
          <div className="flex text-muted">
            <dt className="flex-1">This round</dt>
            <dd className="tabular-nums">{formatVnd(round)}</dd>
          </div>
          <div className="flex text-muted">
            <dt className="flex-1">Service charge</dt>
            <dd>Included</dd>
          </div>
          <div className="text-heading flex">
            <dt className="flex-1">Table total</dt>
            <dd className="tabular-nums">{formatVnd(cart.alreadyOrdered + round)}</dd>
          </div>
        </dl>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        {placeNote && (
          <p role="status" className="text-caption text-center font-semibold text-brand-strong">
            {placeNote}
          </p>
        )}
        <button
          type="button"
          onClick={place}
          disabled={placing || changing} // never send a cart version we are still changing
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {placing ? "Sending…" : <>Place order · <span className="tabular-nums">{formatVnd(round)}</span></>}
        </button>
      </div>
    </>
  );
}
