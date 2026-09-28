"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { LocaleText } from "@/components/ops/locale-text";
import { Money } from "@/components/ops/money";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { browserApi } from "@/lib/api/browser";
import { roleLabel } from "@/lib/auth/roles";
import { denyAccess } from "@/lib/auth/session-client";
import { getNavItem } from "@/lib/nav";
import { useScope } from "@/stores/scope";

export function RoleGate({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const me = useStaffSession();
  const item = getNavItem(href);
  const allowed = Boolean(me && item && item.roles.includes(me.role));
  useEffect(() => {
    if (me && item && !allowed) denyAccess();
  }, [me, item, allowed]);
  if (!me || !item) return null;
  if (!allowed) return <LoadingState label="Taking you to your workspace" />;
  return children;
}

export function Screen({ href }: { href: string }) {
  const me = useStaffSession();
  const item = getNavItem(href);
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const branch = useQuery({
    queryKey: ["branch", branchId, brandId],
    enabled: Boolean(branchId),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await browserApi.GET("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (!response.ok) {
        const detail =
          error && typeof error === "object" && "detail" in error
            ? String(error.detail)
            : `The branch request failed (${response.status}).`;
        throw new Error(detail);
      }
      return data;
    },
  });

  if (!item || !me) return null;

  return (
    <RoleGate href={href}>
      <div className="mx-auto grid max-w-3xl gap-4">
        <header>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.group}
          </p>
          <h1 className="text-[length:var(--text-28)] font-semibold">{item.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {me.full_name}, {roleLabel(me.role)}.
          </p>
        </header>
        <section className="rounded-xl border bg-card p-4 shadow-elev-1">
          <h2 className="text-sm font-medium">Working location</h2>
          {!branchId ? (
            <p className="mt-2 text-sm text-muted-foreground">Open a branch from Brands to work in it.</p>
          ) : branch.isLoading ? (
            <div className="mt-3">
              <LoadingState label="Loading branch" />
            </div>
          ) : branch.isError ? (
            <div className="mt-3">
              <ErrorState
                title="Branch details are unavailable"
                body={branch.error instanceof Error ? branch.error.message : "Retry the branch request."}
                onRetry={() => void branch.refetch()}
              />
            </div>
          ) : (
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Branch</dt>
                <dd className="font-medium">
                  <LocaleText value={branch.data?.name} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sample amount</dt>
                <dd>
                  <Money amount="0.00" currency={branch.data?.currency || "EGP"} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Headers on the next request</dt>
                <dd className="font-mono text-xs break-all">
                  X-Brand-ID {brandId ?? "—"}
                  <br />
                  X-Branch-ID {branchId}
                </dd>
              </div>
            </dl>
          )}
        </section>
        <EmptyState
          title={`${item.label} is ready for phase ${item.phase}`}
          body="The shell, role check, and branch headers are in place. The working tools for this module come in that phase."
        />
      </div>
    </RoleGate>
  );
}
