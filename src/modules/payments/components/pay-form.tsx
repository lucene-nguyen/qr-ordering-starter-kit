"use client";

import { useActionState } from "react";
import { requestPayment, type PayState } from "../actions";

/** 05 · asks the server for this guest's payment; the amount on the QR screen comes from the database. */
export function PayForm({ tableCode, mode, people }: { tableCode: string; mode: "full" | "share"; people: number }) {
  const [state, action, pending] = useActionState<PayState, FormData>(requestPayment, { error: null });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="tableCode" value={tableCode} />
      <input type="hidden" name="mode" value={mode} />
      {mode === "share" && <input type="hidden" name="people" value={people} />}
      {state.error && (
        <p role="alert" className="text-caption rounded-md bg-danger-surface p-3 text-danger">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-[52px] rounded-md bg-brand font-semibold text-white hover:bg-brand-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {pending ? "Preparing…" : "Show payment QR"}
      </button>
    </form>
  );
}
