import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A headline number with its icon. One card per row may be `ink` (black) so the eye lands on
 * the number that matters most; the rest are white with a quiet icon tile, so the black card stays
 * the only strong block in the row. With `href` the whole
 * card opens the report behind it and lifts on hover. `extra` holds a change badge or status,
 * `note` a quiet line under it. Values sit at the same height in every card so a row reads as
 * one line of figures.
 */
export function StatCard({
  label,
  icon: Icon,
  value,
  loading = false,
  extra,
  note,
  href,
  ink = false,
  className,
}: {
  label: ReactNode;
  icon: LucideIcon;
  value: ReactNode;
  loading?: boolean;
  extra?: ReactNode;
  note?: ReactNode;
  href?: string;
  ink?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={cn("text-xs font-medium", ink ? "text-on-ink/70" : "text-ink-secondary")}>{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-staff", ink ? "bg-on-ink/10 text-on-ink" : "bg-well text-ink")}>
          <Icon aria-hidden className="size-4" />
        </span>
      </span>
      <span className="grid gap-1.5">
        {loading ? (
          <span className={cn("h-9 w-28 animate-pulse rounded-staff", ink ? "bg-on-ink/10" : "bg-well")} />
        ) : (
          <span className="truncate text-[24px] leading-8 font-semibold tabular-nums sm:text-[28px] sm:leading-9">{value}</span>
        )}
        {!loading && extra ? <span className="justify-self-start">{extra}</span> : null}
        {note ? <span className={cn("text-xs", ink ? "text-on-ink/60" : "text-ink-secondary")}>{note}</span> : null}
      </span>
    </>
  );
  const surface = cn(
    "grid min-w-0 content-start gap-3 rounded-staff border p-4 shadow-card",
    ink ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink",
    className,
  );
  if (!href) return <div className={surface}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        surface,
        "transition-[background-color,border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:translate-y-0",
        ink ? "hover:bg-brand/90" : "hover:border-ink",
      )}
    >
      {body}
    </Link>
  );
}
