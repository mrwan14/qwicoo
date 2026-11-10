"use client";

import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { AnimatedLogo } from "@/components/brand/animated-logo";
import { LOGO_SURFACE } from "@/components/brand/logo-assets";
import { StaffTheme } from "@/components/ops/kit/theme";
import { fill } from "@/lib/i18n/dictionary";
import { LocaleSwitch } from "@/lib/i18n/locale-switch";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type AuthScreen = "login" | "forgot" | "reset" | "invite";

const corner =
  "inline-flex min-h-10 items-center gap-1.5 rounded-staff px-3 text-[13px] text-ink-secondary transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

// The landing page's 72px line grid, drawn under the logo panel.
const GRID = {
  backgroundColor: LOGO_SURFACE,
  backgroundImage: "linear-gradient(var(--qw-line) 1px, transparent 1px), linear-gradient(90deg, var(--qw-line) 1px, transparent 1px)",
  backgroundSize: "72px 72px",
};

const POINTS = [
  { key: "ordering", swatch: "bg-signal-new" },
  { key: "kitchen", swatch: "bg-signal-wip" },
  { key: "reports", swatch: "bg-signal-done" },
] as const;

/**
 * Split screen: the Qwicoo logo panel from the landing page on one side, the form on the other.
 * On phones the panel shrinks to a logo band above the form.
 */
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
  const year = new Date().getFullYear();

  useEffect(() => {
    document.title = `${page.metaTitle} · Qwicoo`;
  }, [page.metaTitle]);

  return (
    <StaffTheme>
      <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Brand panel. The logo blends with `darken`, so it needs the LOGO_SURFACE background behind it. */}
        <aside className="relative flex flex-col overflow-hidden border-b border-qw-line lg:border-e lg:border-b-0" style={GRID}>
          <div className="relative flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-[clamp(40px,6vw,96px)] lg:py-16">
            <Link
              href="/"
              aria-label={t.shell.homeAria}
              className="block w-[min(220px,60vw)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus lg:w-[min(520px,100%)]"
            >
              <AnimatedLogo />
            </Link>

            <div className="hidden lg:block">
              <p className="mt-12 max-w-[440px] font-title text-[clamp(28px,2.6vw,40px)] leading-[1.1] font-medium text-ink">
                {t.shell.headline}
              </p>
              <ul className="mt-8 grid max-w-[440px] gap-3">
                {POINTS.map(({ key, swatch }) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 border border-qw-line bg-white/70 px-4 py-3 text-[15px] text-ink backdrop-blur-[2px]"
                  >
                    <i aria-hidden className={cn("inline-block size-2.5 shrink-0", swatch)} />
                    {t.shell.points[key]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="relative hidden px-[clamp(40px,6vw,96px)] pb-8 text-xs text-quiet lg:block">{fill(t.shell.copyright, { year })}</p>
        </aside>

        {/* Form column. */}
        <section className="flex min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex justify-end gap-1">
            <LocaleSwitch className={corner} />
            <Link href="/" className={corner}>
              <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              {t.shell.back}
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center py-8">
            <div
              className={cn(
                "grid w-full max-w-[400px] gap-6",
                surface === "card" && "rounded-staff border border-border bg-canvas p-6 shadow-card sm:p-8",
              )}
            >
              <div className="grid gap-1.5">
                <h1 className="font-title text-[28px] leading-tight font-medium text-ink sm:text-[32px]">{page.title}</h1>
                <p className="text-sm leading-relaxed text-ink-secondary">{page.description}</p>
              </div>
              {children}
              {"footer" in page ? (
                <p className="border-t border-border pt-5 text-[13px] leading-relaxed text-ink-secondary">{page.footer}</p>
              ) : null}
            </div>
          </div>

          <p className="text-center text-xs text-ink-secondary lg:hidden">{fill(t.shell.copyright, { year })}</p>
        </section>
      </main>
    </StaffTheme>
  );
}
