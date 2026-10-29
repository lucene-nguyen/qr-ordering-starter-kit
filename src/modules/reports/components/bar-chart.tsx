export type Bar = { key: string; label: string; shortLabel?: string; value: number; display: string; description: string };

const MAX_BAR_PX = 170;

/**
 * Vertical bars in plain CSS (prototype `.chart`): the highest bar in brand orange, the rest light.
 * Screen readers get one list item per bar with its full description. With many bars, only every
 * n-th axis label and no value labels are shown, so the text never overlaps.
 */
export function BarChart({ label, bars }: { label: string; bars: Bar[] }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const labelEvery = Math.ceil(bars.length / 10);
  const showValues = bars.length <= 14;
  return (
    <ol aria-label={label} className="flex h-[230px] items-end gap-1.5 pt-3 sm:gap-3">
      {bars.map((b, i) => {
        const top = max > 0 && b.value === max;
        return (
          <li key={b.key} title={b.description} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="sr-only">{b.description}</span>
            {showValues && (
              <span aria-hidden="true" className={`text-caption tabular-nums ${top ? "font-semibold text-brand-strong" : "text-muted"}`}>
                {b.display}
              </span>
            )}
            <i
              aria-hidden="true"
              className={`block w-full rounded-t-[6px] ${top ? "bg-brand" : "bg-surface-brand"}`}
              style={{ height: max > 0 ? Math.round((b.value / max) * MAX_BAR_PX) : 0 }}
            />
            {/* Only every n-th label shows, so a label may spill over its unlabelled neighbours. */}
            <span aria-hidden="true" className={`text-caption whitespace-nowrap text-muted ${i % labelEvery ? "invisible" : ""}`}>
              {b.shortLabel ? (
                <>
                  <span className="sm:hidden">{b.shortLabel}</span>
                  <span className="hidden sm:inline">{b.label}</span>
                </>
              ) : (
                b.label
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
