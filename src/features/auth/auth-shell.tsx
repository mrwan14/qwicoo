"use client";

import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { StaffTheme } from "@/components/ops/kit/theme";
import { fill } from "@/lib/i18n/dictionary";
import { LocaleSwitch } from "@/lib/i18n/locale-switch";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type AuthScreen = "login" | "forgot" | "reset" | "invite";

const corner =
  "inline-flex min-h-10 items-center gap-1.5 rounded-staff px-3 text-[13px] text-ink-secondary transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

/** One centred card on the subtle background, as in the "All – Login" frame. */
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
    <StaffTheme>
      <main className="flex min-h-dvh flex-col items-center bg-subtle px-4 py-4 sm:py-6">
        <div className="flex w-full max-w-5xl justify-end gap-1">
          <LocaleSwitch className={corner} />
          <Link href="/" className={corner}>
            <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
            {t.shell.back}
          </Link>
        </div>

        <div className="flex w-full flex-1 items-center justify-center py-8">
          <div
            className={cn(
              "grid w-full max-w-[400px] gap-5",
              surface === "card" && "rounded-staff border border-border bg-canvas p-6 sm:p-8",
            )}
          >
            <Link
              href="/"
              aria-label={t.shell.homeAria}
              className="flex w-fit items-center gap-2.5 rounded-staff focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="flex size-9 items-center justify-center rounded-staff bg-ink font-title text-xl font-semibold text-on-ink">
                <span aria-hidden>Q</span>
              </span>
              <span className="text-lg font-semibold text-ink">Qwicoo</span>
            </Link>
            <div className="grid gap-1">
              <h1 className="font-title text-[28px] leading-tight font-medium text-ink sm:text-[32px]">{page.title}</h1>
              <p className="text-sm leading-relaxed text-ink-secondary">{page.description}</p>
            </div>
            {children}
            {"footer" in page ? <p className="text-[13px] leading-relaxed text-ink-secondary">{page.footer}</p> : null}
          </div>
        </div>

        <p className="text-xs text-ink-secondary">{fill(t.shell.copyright, { year: new Date().getFullYear() })}</p>
      </main>
    </StaffTheme>
  );
}
