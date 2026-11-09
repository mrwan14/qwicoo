"use client";

import { cn } from "cn";
import { ArrowDown, ArrowUp } from "lucide-react";

import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import type { Comparison } from "./compare";

/**
 * "▲ 12% vs last week" under a KPI. Green when the move is good for the business, red when it
 * is bad: more sales is good, more cancellations or late arrivals is bad. `good="none"` keeps it grey.
 */
export function Trend({
  change,
  comparison,
  good = "up",
  unit = "percent",
  inverse = false,
}: {
  change: number | null;
  comparison: Comparison;
  good?: "up" | "down" | "none";
  unit?: "percent" | "points";
  /** On a dark (ink) surface: the "vs …" text turns light so it stays readable. */
  inverse?: boolean;
}) {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  if (change === null) return null;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const tone = direction === "flat" || good === "none" ? "neutral" : direction === good ? "good" : "bad";
  const size = Math.abs(change);
  const value = unit === "points" ? fill(t.trend.points, { value: size.toFixed(1) }) : `${formatCount(size, locale)}%`;
  const Icon = direction === "down" ? ArrowDown : ArrowUp;
  return (
    <p className={cn("flex flex-wrap items-center gap-1.5 text-xs", inverse ? "text-on-ink/70" : "text-ink-secondary")}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-staff px-1.5 py-0.5 font-medium text-ink tabular-nums",
          tone === "good" ? "bg-success-bg" : tone === "bad" ? "bg-danger-bg" : "bg-subtle",
        )}
      >
        {direction === "flat" ? null : <Icon aria-hidden className="size-3" />}
        <span className="sr-only">{direction === "up" ? t.trend.up : direction === "down" ? t.trend.down : t.trend.flat}</span>
        {value}
      </span>
      <span>{comparisonLabel(t, comparison)}</span>
    </p>
  );
}

export function comparisonLabel(t: (typeof reportsCopy)["en"], comparison: Comparison): string {
  if (comparison.kind === "week") return t.trend.vsWeek;
  if (comparison.kind === "month") return t.trend.vsMonth;
  return fill(t.trend.vsDays, { count: comparison.days });
}
