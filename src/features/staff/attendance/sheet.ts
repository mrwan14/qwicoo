/** Pure helpers for the timesheet and the attendance rules form. */
import { addDays, monthRange, weekStart } from "./time";

export type Period = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";

export function periodRange(period: Period, today: string): { start: string; end: string } {
  if (period === "thisWeek") return { start: weekStart(today), end: addDays(weekStart(today), 6) };
  if (period === "lastWeek") return { start: addDays(weekStart(today), -7), end: addDays(weekStart(today), -1) };
  return monthRange(today, period === "lastMonth" ? 1 : 0);
}

/** One CSV cell: quoted when needed, and a leading = + - @ is defused so spreadsheets don't run it. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** "" means "use the default" (null); otherwise whole minutes up to `max`, or undefined when invalid. */
export function parseMinutes(text: string, max: number): number | null | undefined {
  const value = text.trim();
  if (value === "") return null;
  if (!/^\d+$/.test(value)) return undefined;
  const minutes = Number(value);
  return minutes <= max ? minutes : undefined;
}
