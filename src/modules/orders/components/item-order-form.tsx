"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatVnd } from "@/lib/money";
import type { MenuItemWithOptions } from "@/modules/menu/types";
import { addToCart } from "../actions";
import { Stepper } from "./stepper";

const pill = "text-caption rounded-full px-2.5 py-0.5";

/** 02 · Item: size, add-ons, note and quantity, then "Add to cart". */
export function ItemOrderForm({
  tableCode,
  item,
  viewOnly = false,
}: {
  tableCode: string;
  item: MenuItemWithOptions;
  viewOnly?: boolean; // table not open yet (00b → View menu only)
}) {
  const router = useRouter();
  const sizes = item.menu_item_sizes;
  const addons = item.menu_item_addons;
  const [sizeId, setSizeId] = useState<string | null>(sizes[0]?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const size = sizes.find((s) => s.id === sizeId) ?? null;
  const chosen = addons.filter((a) => addonIds.includes(a.id));
  const unitPrice = item.price + (size?.extra_price ?? 0) + chosen.reduce((n, a) => n + a.extra_price, 0);
  const soldOut = !item.is_available;

  function add() {
    setError(null);
    start(async () => {
      try {
        // Into the table's shared cart; the server checks the dish, options and quantity again.
        const result = await addToCart(tableCode, { menuItemId: item.id, sizeId, addonIds, note, qty });
        if (!result.ok) return setError(result.message);
        router.push(`/t/${tableCode}`);
      } catch {
        setError("Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <div className="flex-1">
        {sizes.length > 1 && (
          <section aria-labelledby="size-heading" className="border-t border-border px-4 py-3">
            <div className="flex items-center">
              <h2 id="size-heading" className="text-heading flex-1">Size</h2>
              <span className={`${pill} bg-surface-brand text-brand-strong`}>Required</span>
            </div>
            {sizes.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="radio"
                  name="size"
                  checked={sizeId === s.id}
                  onChange={() => setSizeId(s.id)}
                  className="size-5 accent-brand"
                />
                <span className="flex-1">{s.name}</span>
                <span className="text-muted tabular-nums">+{formatVnd(s.extra_price)}</span>
              </label>
            ))}
          </section>
        )}

        {addons.length > 0 && (
          <section aria-labelledby="addons-heading" className="border-t border-border px-4 py-3">
            <div className="flex items-center">
              <h2 id="addons-heading" className="text-heading flex-1">Add-ons</h2>
              <span className={`${pill} bg-surface text-muted`}>Optional</span>
            </div>
            {addons.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={addonIds.includes(a.id)}
                  onChange={(e) =>
                    setAddonIds(e.target.checked ? [...addonIds, a.id] : addonIds.filter((id) => id !== a.id))
                  }
                  className="size-5 accent-brand"
                />
                <span className="flex-1">{a.name}</span>
                <span className="text-muted tabular-nums">+{formatVnd(a.extra_price)}</span>
              </label>
            ))}
          </section>
        )}

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <label htmlFor="note" className="text-heading">Note for the kitchen</label>
          <textarea
            id="note"
            rows={2}
            maxLength={80}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. less spicy, no onion"
            className="resize-none rounded-md bg-surface p-3 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        {error && (
          <p role="alert" className="text-caption w-full text-danger">
            {error}
          </p>
        )}
        <Stepper value={qty} onChange={setQty} label="quantity" />
        <button
          type="button"
          onClick={add}
          disabled={soldOut || viewOnly || pending}
          className="h-[52px] flex-1 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {soldOut ? "Sold out" : viewOnly ? "View only" : pending ? "Adding…" : <>Add to cart · <span className="tabular-nums">{formatVnd(unitPrice * qty)}</span></>}
        </button>
      </div>
    </>
  );
}
