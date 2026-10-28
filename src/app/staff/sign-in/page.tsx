import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/lib/icons";
import { SignInForm } from "@/modules/staff/components/sign-in-form";
import { getStaff, STAFF_HOME } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Sign in · TableTap staff" };

type Props = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> };

// S0 · Staff sign in. Accounts are created by the owner in the Supabase Dashboard (ADR 0002).
export default async function SignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  if (await getStaff()) redirect(STAFF_HOME); // already signed in as staff

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <section className="flex flex-col justify-center gap-4 bg-surface-brand px-6 py-7 md:p-12">
        <span className="grid size-14 place-items-center rounded-full bg-brand text-white">
          <Icon name="utensils" size={26} />
        </span>
        {/* shortcut: restaurant name is fixed until restaurant_settings lands (Phase 5) */}
        <h1 className="text-[30px] leading-[38px] font-bold tracking-[-0.3px]">
          Phở Mây Kitchen
          <br />
          staff console
        </h1>
        <p className="max-w-[360px] text-muted">
          Open tables, follow the kitchen, settle bills and see how the day is going. Each role only
          sees what it needs.
        </p>
      </section>
      <section className="flex w-full max-w-[460px] flex-col justify-center gap-4 justify-self-center p-6 md:p-12">
        <div>
          <h2 className="text-title">Sign in</h2>
          <p className="mt-1 text-muted">Use the account your owner created for you.</p>
        </div>
        <SignInForm
          next={typeof next === "string" ? next : undefined}
          notice={error === "no-access" ? "This account has no staff access. Ask the owner to add you." : undefined}
        />
      </section>
    </main>
  );
}
