import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/lib/icons";
import { formatVnd } from "@/lib/money";
import { RefreshOnBroadcast } from "@/lib/realtime-refresh";
import { PageNav } from "@/modules/orders/components/page-nav";
import { PayForm } from "@/modules/payments/components/pay-form";
import { getPayOptions } from "@/modules/payments/queries";
import { getGuest } from "@/modules/table-session/guest";
import { getTableByCode } from "@/modules/table-session/queries";

export const metadata: Metadata = { title: "Pay your bill · TableTap" };

type Props = {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ mode?: string | string[]; people?: string | string[]; counter?: string | string[] }>;
};

const segment = "flex h-10 flex-1 items-center justify-center rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand";
const round = "grid size-9 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand";

// 05 · Pay: full bill or an equal share. Everything shown here is a server-side preview; the amount
// to transfer is created by the database when the guest asks for the QR (request_payment).
export default async function PayPage({ params, searchParams }: Props) {
  const [{ tableId }, sp] = await Promise.all([params, searchParams]);
  const table = await getTableByCode(tableId);
  if (!table) notFound();
  const guest = await getGuest(table);
  if (!guest) redirect(`/t/${table.code}`); // 00 · Join or 00b

  const wantedPeople = Math.min(8, Math.max(2, Number(sp.people) || 2));
  const options = await getPayOptions(guest.sessionId, guest.guestId, wantedPeople);
  if (options.pendingId) redirect(`/t/${table.code}/pay/${options.pendingId}`); // one open request per guest
  // Once someone at the table split the bill, everyone pays a share.
  const mode = options.splitFixed || sp.mode === "share" ? "share" : "full";
  const people = options.splitPeople;
  const href = (m: string, p = people) => `/t/${table.code}/pay?mode=${m}&people=${p}`;
  const amount = mode === "full" ? options.open : options.share;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <RefreshOnBroadcast channel={`session:${guest.sessionId}`} events={["payment", "cart", "closed"]} />
      <PageNav back={`/t/${table.code}`} title="Pay your bill" subtitle={`${table.label} · Total ${formatVnd(options.bill)}`} />

      <div className="flex flex-1 flex-col gap-3">
        {sp.counter && (
          <p role="status" className="mx-4 flex items-center gap-2 rounded-md bg-surface p-3 text-muted">
            <Icon name="info" size={18} /> No problem – pay at the counter. Our staff can see your bill.
          </p>
        )}
        {options.open <= 0 ? (
          <p className="mx-4 rounded-md bg-surface p-4 text-muted">
            {options.bill === 0 ? "Nothing to pay yet – order something first." : "Everything left is already being paid or settled."}
          </p>
        ) : (
          <>
            <nav aria-label="Payment mode" className="mx-4 flex gap-1 rounded-md bg-surface p-1">
              {!options.splitFixed && (
                <Link href={href("full")} aria-current={mode === "full" ? "true" : undefined} className={`${segment} ${mode === "full" ? "bg-bg shadow-sm" : "text-muted"}`}>
                  Full bill
                </Link>
              )}
              <Link href={href("share")} aria-current={mode === "share" ? "true" : undefined} className={`${segment} ${mode === "share" ? "bg-bg shadow-sm" : "text-muted"}`}>
                Split equally
              </Link>
            </nav>

            {mode === "share" ? (
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <p>Split between</p>
                  <p className="text-caption text-muted">
                    {options.splitFixed ? "Set by the first guest who split" : `Still to pay ${formatVnd(options.open)}`}
                  </p>
                </div>
                {options.splitFixed ? (
                  <output className="text-heading tabular-nums">{people}</output>
                ) : (
                  <div className="flex items-center gap-3">
                    {people > 2 ? (
                      <Link href={href("share", people - 1)} aria-label="Fewer people" className={`${round} border border-border`}>
                        <Icon name="minus" size={16} />
                      </Link>
                    ) : (
                      <span aria-hidden="true" className={`${round} border border-border opacity-40`}><Icon name="minus" size={16} /></span>
                    )}
                    <output aria-label="People" className="text-heading w-5 text-center tabular-nums">{people}</output>
                    {people < 8 ? (
                      <Link href={href("share", people + 1)} aria-label="More people" className={`${round} bg-brand text-white`}>
                        <Icon name="plus" size={16} />
                      </Link>
                    ) : (
                      <span aria-hidden="true" className={`${round} bg-brand text-white opacity-40`}><Icon name="plus" size={16} /></span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="px-4 py-2 text-muted">You&apos;re paying for the whole table.</p>
            )}

            <section className="mx-4 flex flex-col items-center gap-1 rounded-lg border border-border p-5 text-center">
              {amount === null ? (
                <p className="text-muted">Each share would be under 1.000đ – split between fewer people.</p>
              ) : (
                <>
                  <p className="text-display tabular-nums text-brand-strong">{formatVnd(amount)}</p>
                  <p className="text-caption text-muted">{mode === "share" ? `Your share (1 of ${people})` : "Full bill"}</p>
                </>
              )}
            </section>
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-border bg-bg px-4 pt-3.5 pb-7">
        {options.open > 0 && amount !== null && <PayForm tableCode={table.code} mode={mode} people={people} />}
        <Link href={`/t/${table.code}`} className="flex h-[52px] items-center justify-center rounded-md border border-border font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand">
          Back to menu
        </Link>
      </div>
    </main>
  );
}
