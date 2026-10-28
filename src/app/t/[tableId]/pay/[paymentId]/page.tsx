import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { RefreshOnBroadcast } from "@/lib/realtime-refresh";
import { formatTime } from "@/lib/time";
import { PageNav } from "@/modules/orders/components/page-nav";
import { cancelPayment } from "@/modules/payments/actions";
import { bankName } from "@/modules/payments/banks";
import { ActionButton } from "@/modules/payments/components/action-button";
import { CopyButton } from "@/modules/payments/components/copy-button";
import { PaymentQr } from "@/modules/payments/components/payment-qr";
import { getMyPayment, getPaymentQr } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Pay your bill · TableTap" };

type Props = {
  params: Promise<{ tableId: string; paymentId: string }>;
  searchParams: Promise<{ sent?: string | string[] }>;
};

const primary =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-brand font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const secondary =
  "flex h-[52px] w-full items-center justify-center rounded-md border border-border font-semibold hover:bg-surface";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2 text-left">
      <span className="text-muted">{label}</span>
      <span className="ml-auto flex items-center gap-2 text-right font-semibold">{children}</span>
    </div>
  );
}

// 05 (QR) · 05b (waiting for the cashier) · 06 (paid) for one payment of this phone's guest.
// Live: the cashier's confirm and closing the table broadcast on session:<id>; the page re-reads.
export default async function PaymentPage({ params, searchParams }: Props) {
  const [{ tableId, paymentId }, { sent }] = await Promise.all([params, searchParams]);
  const payment = await getMyPayment(tableId, paymentId);
  if (!payment) redirect(`/t/${tableId}`); // not this phone's payment
  const live = <RefreshOnBroadcast channel={`session:${payment.sessionId}`} events={["payment", "closed"]} />;

  // 06 · Paid
  if (payment.status === "confirmed") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
        {live}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid size-22 place-items-center rounded-full bg-success-surface text-success">
            <Icon name="check" size={40} />
          </div>
          <h1 className="text-display">Payment received</h1>
          <p className="tabular-nums text-muted">
            {formatVnd(payment.amount)} · {payment.tableLabel}
            {payment.confirmedAt && ` · ${formatTime(payment.confirmedAt)}`}
          </p>
          <p className="mt-2 flex max-w-[320px] items-start gap-2 rounded-md bg-surface p-3 text-left text-muted">
            <Icon name="bell" size={16} className="mt-1" />
            <span className="text-caption">
              {payment.settled
                ? "The bill is settled. Staff will close the table. Thanks for dining with us!"
                : "The table closes once everyone has paid. Thanks for dining with us!"}
            </span>
          </p>
        </div>
        <div className="px-4 pt-3.5 pb-7">
          <Link href={`/t/${tableId}`} className={primary}>
            Back to menu
          </Link>
        </div>
      </main>
    );
  }

  // Withdrawn (by the guest, by "Paid in cash" or by closing the table): back to choosing / 00b.
  const qr = payment.status === "pending" ? await getPaymentQr(tableId, paymentId) : null;
  if (!qr) redirect(payment.sessionOpen ? `/t/${tableId}/pay` : `/t/${tableId}`);
  const counter = (
    <ActionButton action={cancelPayment.bind(null, tableId)} pendingLabel="Cancelling…" className={secondary}>
      Pay at the counter instead
    </ActionButton>
  );

  // 05b · The guest says they transferred; the cashier confirms by hand (bank webhook: later).
  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
        {live}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid size-22 place-items-center rounded-full bg-surface-brand text-brand-strong">
            <Icon name="clock" size={40} />
          </div>
          <h1 className="text-display">We haven&apos;t received it yet</h1>
          <p className="max-w-[310px] text-muted">
            Some banks take up to a minute. Make sure the amount is <b className="tabular-nums">{formatVnd(qr.amount)}</b>{" "}
            and the transfer note is <b className="tabular-nums">{qr.reference}</b>.
          </p>
          <span className="text-caption rounded-full bg-surface px-3 py-1.5 text-muted">Keep this screen open – it updates by itself</span>
        </div>
        <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-7">
          <Link href={`/t/${tableId}/pay/${paymentId}`} className={primary}>
            <Icon name="refresh" size={18} /> Show the QR again
          </Link>
          {counter}
        </div>
      </main>
    );
  }

  // 05 · QR with the amount and transfer note exactly as the database stored them.
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      {live}
      <PageNav back={`/t/${tableId}`} title="Pay your bill" subtitle={`${payment.tableLabel} · ${payment.kind === "share" ? "Your share" : "Full bill"}`} />
      <div className="flex flex-1 flex-col gap-3">
        <section className="mx-4 flex flex-col items-center gap-3 rounded-lg border border-border p-5 text-center">
          {qr.bank ? (
            <>
              <span className="text-caption text-muted">Scan with any banking app</span>
              <PaymentQr bin={qr.bank.bin} accountNo={qr.bank.accountNo} amount={qr.amount} note={qr.reference} />
            </>
          ) : (
            <>
              <h2 className="text-title">Pay at the counter</h2>
              <p className="text-caption text-muted">Bank transfer isn&apos;t set up yet. Our staff will take your payment.</p>
            </>
          )}
          <div>
            <p className="text-display tabular-nums text-brand-strong">{formatVnd(qr.amount)}</p>
            <p className="text-caption text-muted">{payment.kind === "share" ? "Your share" : "Full bill"}</p>
          </div>
          {qr.bank && (
            <>
              <hr className="w-full border-border" />
              <Row label="Amount">
                <span className="tabular-nums">{formatVnd(qr.amount)}</span>
                <CopyButton text={String(qr.amount)} label="Copy amount" />
              </Row>
              <Row label="Bank">{bankName(qr.bank.bin) ?? qr.bank.bin}</Row>
              <Row label="Account name">{qr.bank.accountName}</Row>
              <Row label="Account no.">
                <span className="tabular-nums">{qr.bank.accountNo}</span>
              </Row>
              <Row label="Transfer note">
                <span className="tabular-nums">{qr.reference}</span>
                <CopyButton text={qr.reference} label="Copy transfer note" />
              </Row>
            </>
          )}
        </section>
        {qr.bank && (
          <p className="flex items-start gap-2 px-5 text-muted">
            <Icon name="info" size={16} className="mt-1" />
            <span className="text-caption">Our cashier confirms the transfer; this screen moves on by itself once they do.</span>
          </p>
        )}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        {qr.bank ? (
          <>
            <Link href={`/t/${tableId}/pay/${paymentId}?sent=1`} className={primary}>
              I&apos;ve completed the transfer
            </Link>
            {counter}
          </>
        ) : (
          // The request stays open, so the cashier sees this amount on C2.
          <Link href={`/t/${tableId}`} className={secondary}>
            Back to menu
          </Link>
        )}
      </div>
    </main>
  );
}
