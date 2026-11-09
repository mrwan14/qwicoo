import type { DateFilter } from "@/components/ops/kit/date-range";

/**
 * The period a report compares itself with.
 * - Up to a week: the same days one week earlier, because restaurant sales follow the weekday.
 * - This month (so far): the same days of last month.
 * - Anything else: the same number of days just before.
 */
export type Comparison = { from: string; to: string; kind: "week" | "month" | "days"; days: number };

const MS_DAY = 86_400_000;

function toUtc(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function spanDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_DAY) + 1;
}

/** Every day in an inclusive range, oldest first. */
export function daysIn(from: string, to: string): string[] {
  const days: string[] = [];
  for (let ms = toUtc(from); ms <= toUtc(to); ms += MS_DAY) days.push(fromUtc(ms));
  return days;
}

export function previousPeriod(range: DateFilter): Comparison {
  const days = spanDays(range.from, range.to);
  if (range.preset === "thisMonth") {
    const year = Number(range.from.slice(0, 4));
    const month = Number(range.from.slice(5, 7)) - 1;
    const start = Date.UTC(year, month - 1, 1);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = Date.UTC(year, month - 1, Math.min(Number(range.to.slice(8, 10)), lastDay));
    return { from: fromUtc(start), to: fromUtc(end), kind: "month", days };
  }
  if (days <= 7) {
    return { from: fromUtc(toUtc(range.from) - 7 * MS_DAY), to: fromUtc(toUtc(range.to) - 7 * MS_DAY), kind: "week", days };
  }
  const to = toUtc(range.from) - MS_DAY;
  return { from: fromUtc(to - (days - 1) * MS_DAY), to: fromUtc(to), kind: "days", days };
}

/** Whole-percent change, or null when there is nothing to compare with. */
export function percentChange(current: number | string | null | undefined, previous: number | string | null | undefined): number | null {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Difference in percentage points, to one decimal, for rates such as the cancellation rate. */
export function pointChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.round((current - previous) * 10) / 10;
}
