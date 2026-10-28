"use client";

import { useRef } from "react";
import { formatVnd } from "@/lib/money";
import { recordCash } from "../staff-actions";
import { ActionButton } from "./action-button";

const button = "h-10 w-full rounded-md border border-border bg-bg px-3 text-[14px] font-semibold hover:bg-surface";

/**
 * C2 · "Paid in cash · 250.000đ". Recording cash withdraws every VietQR request still awaiting, so
 * when there are some the cashier must confirm first: the transfer may already be in the bank,
 * and the table would then pay twice.
 */
export function CashButton({ sessionId, amount, awaiting }: { sessionId: string; amount: number; awaiting: { name: string; amount: number }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = `Paid in cash · ${formatVnd(amount)}`;
  const cash = (
    <ActionButton action={recordCash.bind(null, sessionId)} pendingLabel="Recording…" className={awaiting.length ? `${button} border-0 bg-brand text-white hover:bg-brand-strong` : button}>
      {awaiting.length ? `Record cash · ${formatVnd(amount)}` : label}
    </ActionButton>
  );
  if (!awaiting.length) return cash;

  const who = awaiting.map((a) => `${a.name}'s ${formatVnd(a.amount)}`).join(" and ");
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`${button} focus-visible:outline-2 focus-visible:outline-brand`}>
        {label}
      </button>
      <dialog ref={dialog} aria-labelledby="cash-title" className="m-auto w-[min(420px,calc(100vw-32px))] rounded-lg p-0 backdrop:bg-dark/50">
        <div className="flex flex-col gap-3 p-5">
          <h2 id="cash-title" className="text-title">Record a cash payment?</h2>
          <p className="text-muted">
            {who} transfer {awaiting.length === 1 ? "request" : "requests"} will be cancelled. Check your bank app first — if it
            arrived, confirm it instead.
          </p>
          {cash}
          <button type="button" onClick={() => dialog.current?.close()} className={`${button} focus-visible:outline-2 focus-visible:outline-brand`}>
            Go back
          </button>
        </div>
      </dialog>
    </>
  );
}
