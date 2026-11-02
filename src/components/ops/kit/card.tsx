import { cn } from "cn";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function Card({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("grid content-start gap-3 rounded-staff border border-border bg-canvas p-4", className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3">
          {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {description ? <p className="text-sm leading-normal text-ink-secondary">{description}</p> : null}
      {children}
    </section>
  );
}

/** Small uppercase heading inside cards and panels ("Progress", "Items"). */
export function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-xs font-semibold tracking-wide text-ink-secondary uppercase", className)}>{children}</p>;
}

export function KpiCard({
  label,
  value,
  note,
  loading = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-2 rounded-staff border border-border bg-canvas p-4", className)}>
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      {loading ? (
        <Skeleton className="h-10 w-32 rounded-staff" />
      ) : (
        <p className="truncate text-[26px] leading-tight font-semibold text-ink tabular-nums sm:text-[32px]">{value}</p>
      )}
      {note ? <p className="text-xs text-ink-secondary">{note}</p> : null}
    </div>
  );
}
