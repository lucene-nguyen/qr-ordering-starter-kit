"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../actions";

const field =
  "h-12 w-full rounded-md border-[1.5px] border-border bg-bg px-3.5 outline-none focus:border-brand";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  const error = state.error ?? notice;

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-muted">Email</span>
        {/* React resets the form after each submit; keep what was typed so only the password is retyped */}
        <input name="email" type="email" required autoComplete="username" defaultValue={state.email} key={state.email} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-muted">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-[52px] rounded-md bg-brand font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
