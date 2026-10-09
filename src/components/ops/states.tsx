import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isRoleDenied } from "@/lib/api/error";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="grid gap-3" aria-live="polite">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">{label}</span>
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
    <div className="rounded-xl bg-card p-6 shadow-elev-1">
      <h2 className="text-[length:var(--text-20)] font-semibold">{title}</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
  retryLabel = "Retry",
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 shadow-elev-1">
      <h2 className="text-[length:var(--text-20)] font-semibold">{title}</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function RoleUnavailableState({ screen }: { screen: string }) {
  return (
    <EmptyState
      title="Not available for your role"
      body={`${screen} isn't open to your role yet. Pick another screen from the menu, or ask a branch admin.`}
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
  if (isRoleDenied(error)) return <RoleUnavailableState screen={screen} />;
  const body = error instanceof Error && error.message ? error.message : `${screen} couldn't load.`;
  return <ErrorState title={title} body={body} onRetry={onRetry} />;
}
