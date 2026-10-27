import { cn } from "cn";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-staff border border-border bg-canvas p-8 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-staff border border-border bg-subtle">
        <Icon aria-hidden className="size-[22px] text-ink" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {body ? <p className="max-w-sm text-sm leading-normal text-ink-secondary">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
