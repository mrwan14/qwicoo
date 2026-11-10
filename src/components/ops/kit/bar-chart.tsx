import { cn } from "cn";

export type Bar = { key: string; label: string; value: number; highlight?: boolean };

/**
 * Monochrome column chart: grey bars, the highlighted one in ink. The numbers are also
 * in a hidden table so screen readers get the data, not a picture of it.
 */
export function BarChart({
  bars,
  label,
  format,
  height = 180,
  className,
}: {
  bars: readonly Bar[];
  label: string;
  format: (value: number) => string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  return (
    <div className={cn("grid gap-2", className)}>
      <div aria-hidden className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((bar) => (
          <div key={bar.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${bar.label}: ${format(bar.value)}`}>
            <div
              className={cn("w-full rounded-t-staff", bar.highlight ? "bg-brand" : "bg-ink-secondary/25")}
              style={{ height: max > 0 ? `${Math.max((bar.value / max) * 100, bar.value > 0 ? 2 : 0)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1.5 border-t border-border pt-1.5">
        {bars.map((bar) => (
          <span key={bar.key} className={cn("min-w-0 flex-1 truncate text-center text-[11px] tabular-nums", bar.highlight ? "font-semibold text-ink" : "text-ink-secondary")}>
            {bar.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{format(bar.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Meter = { key: string; label: string; value: number; detail?: string; note?: string };

/** Ranked rows with a thin ink bar under each label, e.g. best sellers. */
export function MeterList({ rows, className }: { rows: readonly Meter[]; className?: string }) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <ol className={cn("grid gap-3", className)}>
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{row.label}</span>
            {row.detail ? <span className="shrink-0 text-ink tabular-nums">{row.detail}</span> : null}
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-brand" style={{ width: max > 0 ? `${(row.value / max) * 100}%` : 0 }} />
          </div>
          {row.note ? <span className="text-xs text-ink-secondary">{row.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}
