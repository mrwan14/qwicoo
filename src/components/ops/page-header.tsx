import type { ReactNode } from "react";

export function PageHeader({
  title,
  action,
  detail,
}: {
  title: string;
  action?: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold tracking-tight">{title}</h1>
        {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
      </div>
      {action}
    </div>
  );
}
