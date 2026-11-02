export type DatePreset = "today" | "yesterday" | "thisWeek" | "thisMonth" | "custom";

export const DATE_PRESETS: readonly DatePreset[] = ["today", "yesterday", "thisWeek", "thisMonth", "custom"];

/** A filter date range. `from` and `to` are local calendar days (YYYY-MM-DD), both inclusive. */
export type DateFilter = { preset: DatePreset; from: string; to: string };

/** Saturday. Most Egyptian calendars start the week on Saturday. */
export const WEEK_STARTS_ON = 6;

export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function presetRange(
  preset: Exclude<DatePreset, "custom">,
  now: Date = new Date(),
  weekStartsOn: number = WEEK_STARTS_ON,
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: isoDay(today), to: isoDay(today) };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: isoDay(yesterday), to: isoDay(yesterday) };
    }
    case "thisWeek": {
      const back = (today.getDay() - weekStartsOn + 7) % 7;
      return { from: isoDay(addDays(today, -back)), to: isoDay(today) };
    }
    case "thisMonth":
      return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDay(today) };
  }
}

/** Picking a preset recomputes the range; Custom keeps whatever range was showing so it can be edited. */
export function withPreset(current: DateFilter, preset: DatePreset, now: Date = new Date()): DateFilter {
  if (preset === "custom") return { ...current, preset };
  return { preset, ...presetRange(preset, now) };
}

export function dateFilter(preset: Exclude<DatePreset, "custom"> = "today", now: Date = new Date()): DateFilter {
  return { preset, ...presetRange(preset, now) };
}
