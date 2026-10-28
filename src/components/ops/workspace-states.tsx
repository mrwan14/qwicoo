"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Skeleton } from "@/components/ui/skeleton";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { DENIED_PARAM } from "@/lib/auth/scope";
import { endStaffSession } from "@/lib/auth/session-client";

/** Shown until `/auth/me` resolves, so no dashboard renders before the scope is known. */
export function WorkspaceLoading() {
  const t = useStaffSection(commonCopy);
  return (
    <main className="grid min-h-dvh place-items-center bg-subtle px-6">
      <div role="status" aria-live="polite" className="grid w-full max-w-xs justify-items-center gap-5">
        <span className="flex size-10 items-center justify-center rounded-staff bg-ink font-title text-xl font-semibold text-on-ink motion-safe:animate-pulse">
          <span aria-hidden>Q</span>
        </span>
        <p className="text-base font-medium text-ink">{t.workspaceReady}</p>
        <div className="grid w-full gap-2">
          <Skeleton className="h-2.5 w-full rounded-staff" />
          <Skeleton className="h-2.5 w-2/3 justify-self-center rounded-staff" />
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
        <span className="flex size-9 items-center justify-center rounded-staff bg-ink font-title text-xl font-semibold text-on-ink">
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
