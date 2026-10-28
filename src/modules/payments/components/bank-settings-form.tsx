"use client";

import { useActionState } from "react";
import { BANKS } from "../banks";
import { saveBankDetails, type SettingsState } from "../settings-actions";

type Current = { name: string; bank_bin: string; account_no: string; account_name: string } | null;

const field = "h-11 rounded-md border border-border bg-bg px-3 focus-visible:outline-2 focus-visible:outline-brand";

/** O3 · bank account for VietQR (owner only). The server normalises and checks every field. */
export function BankSettingsForm({ current }: { current: Current }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveBankDetails, { error: null });
  const v = state.values ?? { name: current?.name ?? "", bin: current?.bank_bin ?? "", accountNo: current?.account_no ?? "", accountName: current?.account_name ?? "" };
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <h2 className="text-heading">Bank account for VietQR</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Bank</span>
          <select name="bin" defaultValue={v.bin} required className={field}>
            <option value="" disabled>
              Choose a bank
            </option>
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Account number</span>
          <input name="accountNo" defaultValue={v.accountNo} inputMode="numeric" autoComplete="off" required className={`${field} tabular-nums`} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-caption text-muted">Account holder name (as printed by the bank)</span>
          <input name="accountName" defaultValue={v.accountName} autoComplete="off" required className={`${field} uppercase`} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-caption text-muted">Restaurant name</span>
          <input name="name" defaultValue={v.name} maxLength={60} required className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Transfer note format</span>
          <input defaultValue="TBL{table} {order}" disabled className={`${field} bg-surface text-muted`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Payment confirmation</span>
          <input defaultValue="Manual by cashier" disabled className={`${field} bg-surface text-muted`} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-caption rounded-md bg-danger-surface p-3 text-danger">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <p role="status" className="text-caption flex-1 text-success">
          {state.saved && !pending ? "Saved. New VietQR codes use these details." : ""}
        </p>
        <button
          disabled={pending}
          className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
