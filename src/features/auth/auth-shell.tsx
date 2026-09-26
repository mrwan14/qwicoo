import Link from "next/link";
import { ArrowLeft, BarChart3, Monitor, QrCode, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Logo, LogoMark } from "@/components/ops/logo";

const PANEL_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: QrCode, text: "QR table ordering, POS, and one menu per brand" },
  { icon: Monitor, text: "Kitchen displays, expo, and a live floor" },
  { icon: BarChart3, text: "Drawer and Z reports, attendance, and analytics" },
];

export function AuthShell({
  title,
  description,
  children,
  footer,
  /** `plain` lets the page place its own surfaces instead of one form card. */
  surface = "card",
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  surface?: "card" | "plain";
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <LogoMark className="pointer-events-none absolute -bottom-20 -end-20 size-96 text-background/5" />

        <Link href="/" className="relative w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
          <Logo markClassName="size-8 text-background" wordClassName="text-xl" />
        </Link>

        <div className="relative grid gap-8">
          <h2 className="font-display max-w-sm text-4xl leading-tight font-semibold">
            Run every branch from one place.
          </h2>
          <ul className="grid gap-4">
            {PANEL_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/10">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="pt-1.5 opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-60">© {new Date().getFullYear()} Qwicoo</p>
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-lg lg:hidden">
            <Logo markClassName="size-7 text-primary" wordClassName="text-lg" />
          </Link>
          <Link
            href="/"
            className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-md gap-6">
            <div className="grid gap-2">
              <h1 className="text-[length:var(--text-28)] leading-tight font-semibold">{title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
            {surface === "card" ? (
              <div className="rounded-2xl border bg-card p-6 shadow-elev-1">{children}</div>
            ) : (
              children
            )}
            {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
