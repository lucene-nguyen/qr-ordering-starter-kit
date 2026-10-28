/**
 * Starter landing page. Replace it as the phases land:
 * Phase 1 adds the guest menu at /t/[tableId]; staff screens live under /staff.
 */
const phases = [
  { key: "LEARNING-95", title: "Table-based menu" },
  { key: "LEARNING-96", title: "Cart and order submission" },
  { key: "LEARNING-97", title: "Realtime kitchen display" },
  { key: "LEARNING-98", title: "Shared cart for one table" },
  { key: "LEARNING-99", title: "Anti-fake orders and payment" },
  { key: "LEARNING-100", title: "Revenue reports" },
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <span className="text-caption font-semibold uppercase tracking-wider text-brand-strong">
          QR Ordering Starter Kit
        </span>
        <h1 className="text-display">TableTap is set up</h1>
        <p className="text-body text-muted">
          Next.js, Tailwind and the design tokens are ready. Start with Phase 1 and follow
          docs/roadmap.md. The clickable UI reference is docs/prototype/tabletap-prototype.html.
        </p>
      </header>

      <ol className="flex flex-col overflow-hidden rounded-lg border border-border">
        {phases.map((phase, i) => (
          <li
            key={phase.key}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-brand text-caption font-semibold text-brand-strong">
              {i + 1}
            </span>
            <span className="text-body flex-1">{phase.title}</span>
            <span className="text-caption text-muted">{phase.key}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
