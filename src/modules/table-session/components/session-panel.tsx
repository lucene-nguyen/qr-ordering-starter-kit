"use client";

import { useState, useTransition } from "react";
import { formatVnd } from "@/lib/money";
import type { BoardTable } from "../board";
import { closeSession, openSession, type SessionResult } from "../staff-actions";
import { StatusPill } from "./table-status";

const button =
  "h-[52px] w-full rounded-md px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted">{label}</span>
      <span className="ml-auto text-right font-semibold">{children}</span>
    </div>
  );
}

/** S1b · open a table / see its PIN, guests and bill / close it. */
export function SessionPanel({
  table,
  openedAt,
  isOwner,
}: {
  table: BoardTable;
  openedAt: string | null; // already formatted in the restaurant's timezone
  isOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const s = table.session;

  const run = (action: () => Promise<SessionResult>) => {
    setError(null);
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn't reach the server. Check the connection.");
      }
    });
  };

  return (
    <section aria-label={`${table.label} details`} className="flex flex-col gap-3.5 rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-title flex-1">{table.label}</h2>
        <StatusPill status={table.status} />
      </div>

      {!s ? (
        <>
          <p className="text-muted">
            Opening a session gives this table a new PIN. Guests need it to join; PINs and phones from earlier
            sessions stop working.
          </p>
          <Row label="Order limit">5 orders / 10 min</Row>
          <button type="button" disabled={pending} onClick={() => run(() => openSession(table.code))} className={`${button} bg-brand text-white hover:bg-brand-strong`}>
            {pending ? "Opening…" : "Open session"}
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1 rounded-md bg-surface p-4 text-center">
            <span className="text-caption text-muted">Table PIN</span>
            <span className="text-[40px] leading-[48px] font-bold tracking-[0.3em] tabular-nums">{s.pin}</span>
            <span className="text-caption text-muted">Read it out to guests when they join. It ends when the table closes.</span>
          </div>
          {s.idle && (
            <p role="status" className="text-caption rounded-md bg-surface-brand p-3 text-brand-strong">
              No activity for more than 3 hours. Check whether the guests are still here.
            </p>
          )}
          <Row label="Opened">{openedAt}</Row>
          <Row label="Guests">{s.guests.length ? s.guests.join(", ") : <span className="font-normal text-muted">Waiting for guests to scan</span>}</Row>
          <Row label="Orders">{s.orders}</Row>
          <hr className="border-border" />
          <Row label="Current bill">
            <span className="text-title tabular-nums">{formatVnd(s.bill)}</span>
          </Row>
          {s.paid > 0 && (
            <Row label="Paid">
              <span className="text-success tabular-nums">{formatVnd(s.paid)}</span>
            </Row>
          )}

          {s.remaining <= 0 ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => closeSession(s.id, ""))} className={`${button} border border-border bg-bg text-danger hover:bg-surface`}>
                {pending ? "Closing…" : "Close session"}
              </button>
              <p className="text-caption text-muted">Closing ends this PIN and every guest phone at this table.</p>
            </>
          ) : isOwner ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-caption text-muted">Reason for closing an unpaid table ({formatVnd(s.remaining)} still open)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="e.g. Guests left without paying"
                  className="resize-none rounded-md border-[1.5px] border-border bg-bg p-3 outline-none focus:border-brand"
                />
              </label>
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={() => run(() => closeSession(s.id, reason))}
                className={`${button} border border-border bg-bg text-danger hover:bg-surface`}
              >
                {pending ? "Closing…" : "Force close"}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled className={`${button} border border-border bg-bg text-danger`}>
                Close session
              </button>
              <p className="text-caption text-muted">
                Settle the bill first ({formatVnd(s.remaining)} still open). Only the owner can close an unpaid table.
              </p>
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-caption rounded-md bg-danger-surface p-3 text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
