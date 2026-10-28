"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { DishPhoto } from "@/modules/menu/components/dish-row";
import { placeOrder } from "../actions";
import { cartTotal, clearCart, setLineQty, submissionKey, useCart } from "../cart";
import { PageNav } from "./page-nav";
import { Stepper } from "./stepper";

const OFFLINE = "Check your connection and try again. Your cart is saved on this phone.";

/** 03 · Cart and 03b · Order failed (the error banner + "Try again"). */
export function CartView({ tableCode, tableLabel }: { tableCode: string; tableLabel: string }) {
  const cart = useCart(tableCode);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const menu = `/t/${tableCode}`;

  if (!cart || placed) return null; // loading from storage, or on the way to the status screen

  const nav = <PageNav back={menu} title="Your order" subtitle={tableLabel} />;
  if (!cart.lines.length) {
    return (
      <>
        {nav}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid size-22 place-items-center rounded-full bg-surface text-muted">
            <Icon name="bag" size={36} />
          </div>
          <p className="text-title">Your cart is empty</p>
          <p className="text-muted">Add a few dishes and they&apos;ll show up here.</p>
        </div>
        <div className="px-4 pt-3.5 pb-7">
          <Link href={menu} className="flex h-[52px] items-center justify-center rounded-md border border-border font-semibold hover:bg-surface">
            Browse the menu
          </Link>
        </div>
      </>
    );
  }

  const total = cartTotal(cart.lines);

  function submit() {
    setError(null);
    const idempotencyKey = submissionKey(tableCode); // same key for every retry of this cart
    const lines = cart!.lines.map((l) => ({
      menuItemId: l.menuItemId,
      sizeId: l.sizeId,
      addonIds: l.addons.map((a) => a.id),
      note: l.note,
      qty: l.qty,
    }));
    startTransition(async () => {
      try {
        const result = await placeOrder({ tableCode, idempotencyKey, lines });
        if (!result.ok) return setError(result.message);
        setPlaced(true);
        clearCart(tableCode);
        router.push(`/t/${tableCode}/order/${result.orderId}`);
      } catch {
        setError(OFFLINE); // the request never got an answer – the cart and its key stay for the retry
      }
    });
  }

  return (
    <>
      {nav}
      <div className="flex-1">
        {error && (
          <div role="alert" className="mx-4 my-2 flex gap-3 rounded-md bg-danger-surface p-3 text-danger">
            <Icon name="wifiOff" size={20} />
            <div>
              <p className="font-semibold">We couldn&apos;t send your order</p>
              <p className="text-caption">{error}</p>
            </div>
          </div>
        )}

        <ul>
          {cart.lines.map((l, i) => {
            const options = [l.sizeName, ...l.addons.map((a) => a.name)].filter(Boolean).join(" · ");
            return (
              <li key={i} className="flex items-start gap-3 border-b border-border px-4 py-3">
                <DishPhoto size={56} className="size-14 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-caption text-muted">{options || "Standard"}</span>
                  {l.note && <span className="text-caption text-brand-strong">Note: {l.note}</span>}
                </div>
                <div className="flex flex-col items-end gap-2.5">
                  <span className="font-semibold tabular-nums">{formatVnd(l.unitPrice * l.qty)}</span>
                  <Stepper value={l.qty} min={0} onChange={(q) => setLineQty(tableCode, i, q)} label={l.name} />
                </div>
              </li>
            );
          })}
        </ul>

        <Link href={menu} className="flex items-center gap-2 p-4 font-semibold text-brand-strong">
          <Icon name="plus" /> Add more items
        </Link>

        <dl className="flex flex-col gap-2 px-4 py-2">
          <div className="flex text-muted">
            <dt className="flex-1">Service charge</dt>
            <dd>Included</dd>
          </div>
          <div className="text-heading flex">
            <dt className="flex-1">Total</dt>
            <dd className="tabular-nums">{formatVnd(total)}</dd>
          </div>
        </dl>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {pending ? (
            "Sending…"
          ) : (
            <>
              {error && <Icon name="refresh" />}
              {error ? "Try again" : "Place order"} · <span className="tabular-nums">{formatVnd(total)}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
