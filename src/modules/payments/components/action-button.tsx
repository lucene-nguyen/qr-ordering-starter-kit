"use client";

import { useState, useTransition } from "react";

type Result = { ok: true } | { ok: false; message: string } | { error: string | null };

/** A button that runs one Server Action (already bound to its arguments) and shows its error. */
export function ActionButton({
  action,
  children,
  pendingLabel,
  className,
  disabled,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              const r = await action();
              if (!r) return; // the action redirected: the router is already navigating
              const message = "ok" in r ? (r.ok ? null : r.message) : r.error;
              if (message) setError(message);
            } catch {
              setError("Couldn't reach the server. Check the connection.");
            }
          });
        }}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
      >
        {pending ? pendingLabel : children}
      </button>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </>
  );
}
