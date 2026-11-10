"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AnimatedLogo } from "@/components/brand/animated-logo";
import { LOGO_SURFACE } from "@/components/brand/logo-assets";
import { Button } from "@/components/ops/kit/button";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { DENIED_PARAM } from "@/lib/auth/scope";
import { endStaffSession } from "@/lib/auth/session-client";

// The login page's Qwicoo surface: warm canvas with the landing page's 72px line grid.
// The animated logo blends with `darken`, so it needs LOGO_SURFACE behind it.
const BRAND_SURFACE = {
  backgroundColor: LOGO_SURFACE,
  backgroundImage: "linear-gradient(var(--qw-line) 1px, transparent 1px), linear-gradient(90deg, var(--qw-line) 1px, transparent 1px)",
  backgroundSize: "72px 72px",
};

/** The three Qwicoo signal colours (new · in progress · done), pulsing in turn. */
const DOTS = ["bg-signal-new", "bg-signal-wip", "bg-signal-done"] as const;

/** Shown until `/auth/me` resolves, so no dashboard renders before the scope is known. */
export function WorkspaceLoading() {
  const t = useStaffSection(commonCopy);
  return (
    <main className="grid min-h-dvh place-items-center px-6" style={BRAND_SURFACE}>
      <div role="status" aria-live="polite" className="grid w-full max-w-sm justify-items-center gap-6">
        {/* Play only the settle at the end of the logo animation, as the QR splash does. */}
        <AnimatedLogo className="w-[min(280px,70vw)]" startAt={2.1} />
        <div className="grid justify-items-center gap-3">
          <p className="text-base font-medium text-ink">{t.workspaceReady}</p>
          <span aria-hidden className="flex items-center gap-2">
            {DOTS.map((dot, index) => (
              <i
                key={dot}
                className={`size-2.5 ${dot} motion-safe:animate-pulse`}
                style={{ animationDelay: `${index * 200}ms` }}
              />
            ))}
          </span>
        </div>
      </div>
    </main>
  );
}

export function NoWorkspace() {
  const t = useStaffSection(commonCopy);
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-dvh place-items-center bg-subtle px-4">
      <div className="grid w-full max-w-[400px] gap-5 rounded-staff border border-border bg-canvas p-8">
        <span className="flex size-9 items-center justify-center rounded-staff bg-brand font-title text-xl font-semibold text-on-brand">
          <span aria-hidden>Q</span>
        </span>
        <div className="grid gap-1.5">
          <h1 className="font-title text-[28px] leading-tight font-medium text-ink">{t.noWorkspace}</h1>
          <p className="text-sm leading-relaxed text-ink-secondary">{t.noWorkspaceBody}</p>
        </div>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void endStaffSession();
          }}
        >
          {pending ? t.signingOut : t.signOut}
        </Button>
      </div>
    </main>
  );
}

/** Reads `?denied=1` after a scope redirect, shows the toast once, and drops the param. */
export function AccessDeniedToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useStaffSection(commonCopy);
  const denied = params.get(DENIED_PARAM) === "1";

  useEffect(() => {
    if (!denied) return;
    toast(t.accessDenied, {
      id: "scope-denied",
      description: t.accessDeniedBody,
    });
    const next = new URLSearchParams(params.toString());
    next.delete(DENIED_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [denied, params, pathname, router, t]);

  return null;
}
