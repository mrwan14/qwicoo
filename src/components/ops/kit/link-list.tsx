import { cn } from "cn";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SectionLabel } from "@/components/ops/kit/card";

/** A titled group of navigation rows, for hubs like Settings and Reports. */
export function LinkGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("grid content-start gap-2", className)}>
      <SectionLabel>{label}</SectionLabel>
      <ul className="grid overflow-hidden rounded-staff border border-border bg-canvas">{children}</ul>
    </section>
  );
}

/** One row: icon, title, a line of description. Without `href` it renders disabled with `aside` (e.g. "Coming soon"). */
export function LinkRow({
  href,
  icon: Icon,
  title,
  description,
  aside,
}: {
  href?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-staff border border-border bg-subtle">
        <Icon aria-hidden className={cn("size-[18px]", href ? "text-ink" : "text-disabled")} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("text-sm font-semibold", href ? "text-ink" : "text-ink-secondary")}>{title}</span>
        {description ? <span className="text-[13px] leading-snug text-ink-secondary">{description}</span> : null}
      </span>
      {aside}
      {href ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-secondary rtl:-scale-x-100" /> : null}
    </>
  );
  const row = "flex min-h-16 items-center gap-3 px-4 py-3";
  return (
    <li className="border-b border-border last:border-b-0">
      {href ? (
        <Link
          href={href}
          className={cn(row, "transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus")}
        >
          {body}
        </Link>
      ) : (
        <div className={row} aria-disabled="true">
          {body}
        </div>
      )}
    </li>
  );
}
