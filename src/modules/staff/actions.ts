"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { STAFF_HOME } from "./queries";

export type SignInState = { error: string | null; email?: string };

const signInInput = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password, next } = parsed.data;

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email or password is incorrect.", email };

  // Only go back to a staff page – never to an outside URL passed in `next` (open redirect).
  redirect(next?.startsWith("/staff/") && !next.startsWith("//") ? next : STAFF_HOME);
}

export async function signOut() {
  const supabase = await createAuthClient();
  // Only this device: the default scope is "global", which would also sign out every other
  // tablet sharing the account (e.g. all kitchen screens on bep@).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/staff/sign-in");
}
