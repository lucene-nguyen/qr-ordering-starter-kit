"use client";

import { Icon } from "@/lib/icons";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-[42px] items-center gap-2 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <Icon name="printer" /> Print all cards
    </button>
  );
}
