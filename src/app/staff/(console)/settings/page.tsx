import type { Metadata } from "next";
import { formatVnd } from "@/lib/money";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { bankName } from "@/modules/payments/banks";
import { BankSettingsForm } from "@/modules/payments/components/bank-settings-form";
import { PaymentQr } from "@/modules/payments/components/payment-qr";
import { NoAccess } from "@/modules/staff/components/no-access";
import { SettingsTabs } from "@/modules/staff/components/settings-tabs";
import { allowed, CAN, requireStaff } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Settings · Payment · TableTap" };

const TEST_AMOUNT = 10000; // small, so a test scan is harmless even if someone completes it

// O3 · Settings › Payment. Owner only. The preview is a real VietQR for the saved account, so the
// owner can scan it with a banking app and check the bank and name before guests use it.
export default async function PaymentSettingsPage() {
  const staff = await requireStaff();
  if (!allowed(staff, CAN.manageSettings)) {
    return <NoAccess title="Settings are for the owner" description="Bank details and table QR codes can only be changed by the owner." />;
  }
  const { data: current, error } = await (await createAuthClient())
    .from("restaurant_settings")
    .select("name, bank_bin, account_no, account_name")
    .maybeSingle();
  if (error) throw error;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-display">Settings</h1>
        <p className="text-muted">Where guests send money when they pay with VietQR.</p>
      </header>
      <SettingsTabs current="/staff/settings" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <BankSettingsForm current={current} />
        <section aria-label="Guest preview" className="flex flex-col items-center gap-2 rounded-lg border border-border p-5 text-center">
          <span className="text-caption text-muted">Guest preview</span>
          {current ? (
            <>
              <PaymentQr bin={current.bank_bin} accountNo={current.account_no} amount={TEST_AMOUNT} note="TABLETAP TEST" />
              <p className="text-display tabular-nums text-brand-strong">{formatVnd(TEST_AMOUNT)}</p>
              <p className="flex w-full justify-between gap-2">
                <span className="text-muted">Bank</span> <b>{bankName(current.bank_bin) ?? current.bank_bin}</b>
              </p>
              <p className="flex w-full justify-between gap-2">
                <span className="shrink-0 text-muted">Account name</span> <b className="text-right">{current.account_name}</b>
              </p>
              <p className="text-caption text-muted">
                Scan it with your banking app: it should show this bank and name. No need to finish the transfer.
              </p>
            </>
          ) : (
            <p className="text-muted">No bank account yet – guests are asked to pay at the counter.</p>
          )}
        </section>
      </div>
    </main>
  );
}
