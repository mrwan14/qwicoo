"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

import { moveInRow } from "@/components/ops/kit/roving";

export type SegmentItem<T extends string = string> = { value: T; label: string; icon?: LucideIcon };

/** Ink-filled toggle for views (List / Tables) and date presets. */
export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: readonly SegmentItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-staff border border-border bg-canvas p-[3px]", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => {
              const next = moveInRow(event, "radio");
              if (next !== null) onValueChange(items[next].value);
            }}
            className={cn(
              "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-staff px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
              active ? "bg-ink text-on-ink" : "text-ink hover:bg-subtle",
            )}
          >
            {Icon ? <Icon aria-hidden className={cn("size-3.5", active ? "text-on-ink" : "text-ink-secondary")} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
