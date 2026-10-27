import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Fraunces page title with an optional back link above and actions on the end side. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="grid gap-4">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {back.label}
        </Link>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="font-title text-[28px] leading-tight font-medium text-ink sm:text-[32px]">{title}</h1>
          {subtitle ? <p className="text-sm text-ink-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    </div>
  );
}
