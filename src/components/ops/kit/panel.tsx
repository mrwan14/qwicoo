import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A section card with a tinted header bar: small caps title (with an optional icon) on the start
 * side, a count or link on the end side. The body runs edge to edge, so lists and tables inside
 * it need no box of their own; `padded` adds the usual inner spacing for anything else.
 */
export function Panel({
  title,
  icon: Icon,
  action,
  padded = false,
  className,
  children,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-staff border border-border bg-canvas shadow-card", className)}>
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-border bg-well px-4 py-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
          {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
          {title}
        </h2>
        {action ? <div className="text-xs">{action}</div> : null}
      </header>
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

/** The quiet link or count in a panel header. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-ink underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
