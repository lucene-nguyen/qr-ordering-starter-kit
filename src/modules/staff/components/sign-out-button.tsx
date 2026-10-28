import { Icon } from "@/lib/icons";
import { signOut } from "../actions";

/** A form, so signing out works even before JavaScript has loaded. */
export function SignOutButton({ className }: { className: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={`flex items-center gap-2 ${className}`}>
        <Icon name="logout" size={16} /> Sign out
      </button>
    </form>
  );
}
