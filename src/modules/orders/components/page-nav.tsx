import Link from "next/link";
import { Icon } from "@/lib/icons";

/** Back button + title row used by the cart and order status screens. */
export function PageNav({ back, title, subtitle }: { back: string; title: string; subtitle: string }) {
  return (
    <header className="flex items-center gap-3 px-4 py-2">
      <Link
        href={back}
        aria-label="Back to menu"
        className="grid size-10 place-items-center rounded-full border border-border bg-bg focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Icon name="back" size={20} />
      </Link>
      <div>
        <h1 className="text-title">{title}</h1>
        <p className="text-caption text-muted">{subtitle}</p>
      </div>
    </header>
  );
}
