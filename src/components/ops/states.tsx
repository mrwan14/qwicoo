"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isRoleDenied } from "@/lib/api/error";
import { fill } from "@/lib/i18n/dictionary";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export function LoadingState({ label }: { label?: string }) {
  const t = useStaffSection(commonCopy);
  const text = label ?? t.loading;
  return (
    <div role="status" className="grid gap-3" aria-live="polite">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">{text}</span>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-card p-6">
      <h2 className="text-[length:var(--text-20)] font-semibold">{title}</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const t = useStaffSection(commonCopy);
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 shadow-elev-1">
      <h2 className="text-[length:var(--text-20)] font-semibold">{title ?? t.somethingWrong}</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {retryLabel ?? t.retry}
        </button>
      ) : null}
    </div>
  );
}

export function RoleUnavailableState({ screen }: { screen: string }) {
  const t = useStaffSection(commonCopy);
  return (
    <EmptyState
      title={t.roleUnavailable}
      body={fill(t.roleUnavailableBody, { screen })}
    />
  );
}

/** A role refusal is expected, not a failure: show it calmly instead of as an error. */
export function QueryErrorState({
  error,
  screen,
  title,
  onRetry,
}: {
  error: unknown;
  screen: string;
  title?: string;
  onRetry?: () => void;
}) {
  const t = useStaffSection(commonCopy);
  if (isRoleDenied(error)) return <RoleUnavailableState screen={screen} />;
  const body = error instanceof Error && error.message ? error.message : fill(t.couldntLoad, { screen });
  return <ErrorState title={title} body={body} onRetry={onRetry} />;
}
