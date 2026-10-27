import { cn } from "cn";
import type { ReactNode } from "react";

/** The only colour in the staff UI. Everything else is black, white and grey. */
export type Tone = "warning" | "danger" | "info" | "success" | "neutral";

const SURFACE: Record<Tone, string> = {
  warning: "border-transparent bg-warning-bg",
  danger: "border-transparent bg-danger-bg",
  info: "border-transparent bg-info-bg",
  success: "border-transparent bg-success-bg",
  neutral: "border-border bg-subtle",
};

const DOT: Record<Tone, string> = {
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  success: "bg-success",
  neutral: "bg-ink-secondary",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-staff border px-2 py-[3px] text-xs font-medium whitespace-nowrap text-ink",
        SURFACE[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}

/** A coloured dot before plain text, for lists like "Needs attention". */
export function StatusDot({ tone, className, children }: { tone: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-ink", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}
