"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LogoMark } from "@/components/ops/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { DENIED_PARAM } from "@/lib/auth/scope";
import { endStaffSession } from "@/lib/auth/session-client";

/** Shown until `/auth/me` resolves, so no dashboard renders before the scope is known. */
export function WorkspaceLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div role="status" aria-live="polite" className="grid w-full max-w-sm justify-items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogoMark className="size-9 motion-safe:animate-pulse" />
        </span>
        <p className="font-display text-xl">Getting your workspace ready</p>
        <div className="grid w-full gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3 justify-self-center" />
        </div>
      </div>
    </main>
  );
}

export function NoWorkspace() {
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="grid w-full max-w-md gap-4 rounded-2xl border bg-card p-6 text-center shadow-elev-1">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogoMark className="size-8" />
        </span>
        <h1 className="font-display text-[length:var(--text-28)] leading-tight">No access to any workspace</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account is not linked to a brand or branch right now. Contact your admin to get access, then sign in again.
        </p>
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          onClick={() => {
            setPending(true);
            void endStaffSession();
          }}
        >
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </main>
  );
}

/** Reads `?denied=1` after a scope redirect, shows the toast once, and drops the param. */
export function AccessDeniedToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const denied = params.get(DENIED_PARAM) === "1";

  useEffect(() => {
    if (!denied) return;
    toast("You don't have access to that", {
      id: "scope-denied",
      description: "We brought you back to your workspace.",
    });
    const next = new URLSearchParams(params.toString());
    next.delete(DENIED_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [denied, params, pathname, router]);

  return null;
}
