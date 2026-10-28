import { Icon } from "@/lib/icons";

/** − qty + control. `min` 0 lets the cart remove a line. */
export function Stepper({
  value,
  onChange,
  label,
  min = 1,
  max = 50,
}: {
  value: number;
  onChange: (qty: number) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  const round =
    "grid size-8 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={`${round} border border-border bg-bg`}
      >
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite" className="min-w-[18px] text-center font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={`${round} bg-brand text-white`}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
