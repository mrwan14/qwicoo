import Link from "next/link";
import type { ReactNode } from "react";

export function EntityCard({
  href,
  title,
  meta,
  badge,
}: {
  href: string;
  title: string;
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  const mark = title.trim().charAt(0).toUpperCase() || "B";
  return (
    <Link
      href={href}
      className="flex min-h-28 flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-lg font-semibold text-primary">
          {mark}
        </span>
        {badge}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
    </Link>
  );
}
