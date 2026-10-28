"use client";

import { useActionState, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { joinTable, type JoinState } from "../actions";

/** Who is already here, as one sentence: "Minh", "Minh and Lan", "Minh and 2 others". */
const whoIsHere = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names[0]} and ${names.length - 1} others`;

const box =
  "h-14 w-12 rounded-md border-[1.5px] border-border bg-bg text-center text-title tabular-nums outline-none focus:border-brand";

/**
 * Four one-digit boxes. Typing moves on, Backspace on an empty box moves back, and pasting or
 * autofilling (one-time-code) "1234" into any box fills all four. Sends one field: `pin`.
 */
function PinInput() {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (from: number, text: string) => {
    const incoming = text.replace(/\D/g, "").slice(0, 4 - from).split("");
    if (!incoming.length) return;
    setDigits((d) => d.map((x, i) => (i >= from && i < from + incoming.length ? incoming[i - from]! : x)));
    boxes.current[Math.min(from + incoming.length, 3)]?.focus();
  };

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-caption mb-1.5 text-muted">Table PIN (ask our staff)</legend>
      <div className="flex gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`PIN digit ${i + 1} of 4`}
            className={box}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData("text"));
            }}
            onChange={(e) => {
              const typed = e.target.value.replace(/\D/g, "");
              if (typed.length >= 4) return fill(0, typed); // autofill of the whole code
              setDigits((d) => d.map((x, j) => (j === i ? typed.slice(-1) : x))); // newest digit wins
              if (typed && i < 3) boxes.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digit && i > 0) boxes.current[i - 1]?.focus();
            }}
          />
        ))}
      </div>
      <input type="hidden" name="pin" value={digits.join("")} />
    </fieldset>
  );
}

/** 00 · Join table: name (optional) and the session PIN, then into the menu. */
export function JoinScreen({
  tableCode,
  tableLabel,
  openedAt,
  guestNames,
}: {
  tableCode: string;
  tableLabel: string;
  openedAt: string; // "14:05", in the restaurant's timezone
  guestNames: string[];
}) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinTable, { error: null });

  return (
    <form action={action} className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <input type="hidden" name="tableCode" value={tableCode} />
      <div className="flex flex-1 flex-col">
        <section className="flex flex-col items-center gap-3 bg-surface-brand px-6 pt-10 pb-8 text-center">
          <span className="grid size-[72px] place-items-center rounded-full bg-brand text-white">
            <Icon name="utensils" size={32} />
          </span>
          {/* shortcut: restaurant name is fixed until restaurant_settings lands (Phase 5, commit 6) */}
          <h1 className="text-display">Phở Mây Kitchen</h1>
          <span className="rounded-full bg-bg px-3 py-2 text-[13px] font-medium text-brand-strong">{tableLabel}</span>
          <span className="text-caption flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full bg-success" />
            Session open · started {openedAt}
          </span>
        </section>

        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-title">What should we call you?</h2>
            <p className="mt-1 text-muted">Your name helps everyone at the table see who added each dish.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-caption text-muted">Your name</span>
            {/* React resets the form after each submit; keep the name when only the PIN was wrong */}
            <input
              name="name"
              maxLength={20}
              autoComplete="given-name"
              placeholder="Optional"
              defaultValue={state.name}
              key={state.name}
              className="h-12 rounded-md border-[1.5px] border-border bg-bg px-3.5 outline-none focus:border-brand"
            />
          </label>
          <PinInput />
          {guestNames.length > 0 && (
            <p className="text-caption flex items-start gap-2 rounded-md bg-surface p-3 text-muted">
              <Icon name="users" />
              {whoIsHere(guestNames)} {guestNames.length === 1 ? "is" : "are"} already at this table. You&apos;ll share one cart.
            </p>
          )}
          {state.error && (
            <p role="alert" className="text-caption text-danger">
              {state.error}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pt-3.5 pb-7">
        <button
          type="submit"
          disabled={pending}
          className="h-[52px] w-full rounded-md bg-brand font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {pending ? "Joining…" : "Join table & view menu"}
        </button>
      </div>
    </form>
  );
}
