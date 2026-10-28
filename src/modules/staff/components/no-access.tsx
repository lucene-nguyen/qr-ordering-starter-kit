import Link from "next/link";
import { Icon } from "@/lib/icons";
import { STAFF_HOME } from "../queries";
import { SignOutButton } from "./sign-out-button";

/** O2b-style "this role can't see this page" screen. */
export function NoAccess({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-22 place-items-center rounded-full bg-surface text-muted">
        <Icon name="lock" size={40} />
      </div>
      <h1 className="text-display">{title}</h1>
      <p className="text-muted">{description}</p>
      <div className="flex gap-2">
        <Link href={STAFF_HOME} className="flex h-[42px] items-center rounded-md border border-border px-4 font-semibold hover:bg-surface">
          Back to my console
        </Link>
        <SignOutButton className="h-[42px] rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong" />
      </div>
    </main>
  );
}
