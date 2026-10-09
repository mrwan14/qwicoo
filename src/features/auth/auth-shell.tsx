"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, Monitor, QrCode, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AnimatedLogo } from "@/components/brand/animated-logo";
import { LogoMark } from "@/components/ops/logo";
import { fill } from "@/lib/i18n/dictionary";
import { LocaleSwitch } from "@/lib/i18n/locale-switch";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

const PANEL_POINTS: { icon: LucideIcon; key: keyof typeof authCopy.en.shell.points }[] = [
  { icon: QrCode, key: "ordering" },
  { icon: Monitor, key: "kitchen" },
  { icon: BarChart3, key: "reports" },
];

export type AuthScreen = "login" | "forgot" | "reset" | "invite";

export function AuthShell({
  screen,
  children,
  /** `plain` lets the page place its own surfaces instead of one form card. */
  surface = "card",
}: {
  screen: AuthScreen;
  children: ReactNode;
  surface?: "card" | "plain";
}) {
  const t = useStaffSection(authCopy);
  const page = t[screen];

  useEffect(() => {
    document.title = `${page.metaTitle} · Qwicoo`;
  }, [page.metaTitle]);

  return (
    <main className="grid min-h-dvh bg-[#f2efe9] lg:bg-background lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#f2efe9] p-10 text-neutral-900 lg:flex">
        <LogoMark className="pointer-events-none absolute -bottom-20 -end-20 size-96 text-neutral-900/[0.04]" />

        <Link
          href="/"
          aria-label={t.shell.homeAria}
          className="relative -ms-2 -mt-2 block w-full max-w-[34rem] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <AnimatedLogo />
        </Link>

        <div className="relative grid gap-8">
          <h2 className="font-display max-w-sm text-4xl leading-tight font-semibold">{t.shell.headline}</h2>
          <ul className="grid gap-4">
            {PANEL_POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900/[0.07]">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="pt-1.5 opacity-90">{t.shell.points[key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-60">{fill(t.shell.copyright, { year: new Date().getFullYear() })}</p>
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-8 lg:bg-background">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" aria-label={t.shell.homeAria} className="-ms-1 -mt-2 block w-64 rounded-lg sm:w-80 lg:hidden">
            <AnimatedLogo />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitch />
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              {t.shell.back}
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-md gap-6">
            <div className="grid gap-2">
              <h1 className="text-[length:var(--text-28)] leading-tight font-semibold">{page.title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{page.description}</p>
            </div>
            {surface === "card" ? (
              <div className="rounded-2xl border bg-card p-6 shadow-elev-1">{children}</div>
            ) : (
              children
            )}
            {"footer" in page ? <div className="text-sm text-muted-foreground"><p>{page.footer}</p></div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
