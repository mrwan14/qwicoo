"use client";

import { cn } from "cn";
import Link from "next/link";

import { moveInRow } from "@/components/ops/kit/roving";

export type TabItem<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
  /** Link tabs change the URL (e.g. `?tab=`); without it the tab calls `onValueChange`. */
  href?: string;
  disabled?: boolean;
};

const tabClass = (active: boolean) =>
  cn(
    "-mb-px inline-flex shrink-0 items-center border-b-2 px-0.5 py-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-disabled",
    active ? "border-ink font-semibold text-ink" : "border-transparent text-ink-secondary hover:text-ink",
  );

/** Underlined page tabs. The design allows four at most. */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onValueChange?: (value: T) => void;
  label: string;
  className?: string;
}) {
  if (process.env.NODE_ENV !== "production" && items.length > 4) {
    console.warn(`Tabs "${label}": the design allows at most 4 tabs, got ${items.length}.`);
  }
  const text = (item: TabItem<T>) => (item.count === undefined ? item.label : `${item.label} · ${item.count}`);
  const row = "flex gap-7 overflow-x-auto border-b border-border";

  if (items.some((item) => item.href)) {
    return (
      <nav aria-label={label} className={cn(row, className)}>
        {items.map((item) =>
          item.href && !item.disabled ? (
            <Link
              key={item.value}
              href={item.href}
              aria-current={item.value === value ? "page" : undefined}
              className={tabClass(item.value === value)}
            >
              {text(item)}
            </Link>
          ) : (
            <span key={item.value} aria-disabled className={cn(tabClass(false), "cursor-not-allowed text-disabled hover:text-disabled")}>
              {text(item)}
            </span>
          ),
        )}
      </nav>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={cn(row, className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange?.(item.value)}
            onKeyDown={(event) => {
              const next = moveInRow(event, "tab");
              const enabled = items.filter((tab) => !tab.disabled);
              if (next !== null) onValueChange?.(enabled[next].value);
            }}
            className={tabClass(active)}
          >
            {text(item)}
          </button>
        );
      })}
    </div>
  );
}
