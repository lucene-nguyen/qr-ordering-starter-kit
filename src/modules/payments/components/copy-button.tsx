"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";

/** Copies `text` (e.g. the transfer note) so guests can paste it into their banking app. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {} // no clipboard permission: the text stays visible to copy by hand
      }}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-bg hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Icon name={copied ? "check" : "copy"} size={16} />
      <span role="status" className="sr-only">{copied ? "Copied" : ""}</span>
    </button>
  );
}
