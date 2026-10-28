"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/lib/icons";
import { DishPhoto } from "@/modules/menu/components/dish-row";

export type DishAvailability = { id: string; name: string; is_available: boolean };

/** "Sold out today" drawer on the kitchen display. */
export function SoldOutDrawer({
  dishes,
  onToggle,
  onClose,
}: {
  dishes: DishAvailability[];
  onToggle: (dish: DishAvailability) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-10 bg-dark/35" />
      <div role="dialog" aria-modal="true" aria-labelledby="soldout-title" className="fixed inset-y-0 right-0 z-20 flex w-full max-w-[440px] flex-col bg-bg shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <h2 id="soldout-title" className="text-title flex-1">Sold out today</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full border border-border focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-5">
          <p className="mb-3 text-muted">Switch off a dish and every table&apos;s menu shows it as sold out straight away.</p>
          {dishes.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-1.5">
              <DishPhoto size={40} className="size-10 rounded-md" />
              <span className="flex-1 font-semibold">{d.name}</span>
              <button
                type="button"
                role="switch"
                aria-checked={d.is_available}
                aria-label={`${d.name} available`}
                onClick={() => onToggle(d)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  d.is_available ? "bg-success" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${d.is_available ? "left-[18px]" : "left-0.5"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
