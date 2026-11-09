/** Wall-clock helpers for attendance: the API answers in the branch timezone, with an offset. */

const pad = (value: number) => String(value).padStart(2, "0");

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** "2026-09-20" + "11:10" in Africa/Cairo → "2026-09-20T11:10:00+03:00" (summer time included). */
export function zonedIso(day: string, clock: string, timeZone: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  const first = offsetMinutes(guess, timeZone);
  const offset = offsetMinutes(guess - first * 60000, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${day}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** "2026-11-09" moved by a number of days. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function nextDay(day: string): string {
  return addDays(day, 1);
}

/** The Monday of the week holding `day` (weeks run Monday to Sunday, like the API's weekly filter). */
export function weekStart(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/** First and last day of the month holding `day`, optionally a number of months before. */
export function monthRange(day: string, monthsBack = 0): { start: string; end: string } {
  const [year, month] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const iso = (value: Date) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  return { start: iso(first), end: iso(last) };
}

/** "HH:MM" of a timestamp at the branch, whatever offset the API sent it with. */
export function clockOf(iso: string | null | undefined, timeZone = "Africa/Cairo"): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "" : branchNow(timeZone, at).clock;
}

/** Arrived and left as timestamps; a leave time earlier than arrival is the next morning. */
export function shiftTimes(day: string, arrived: string, left: string, timeZone: string): { checkIn: string; checkOut: string | null } {
  const checkIn = zonedIso(day, arrived, timeZone);
  if (!left) return { checkIn, checkOut: null };
  return { checkIn, checkOut: zonedIso(left <= arrived ? nextDay(day) : day, left, timeZone) };
}

export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function minutesSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** The current wall-clock "HH:MM" and day at the branch. */
export function branchNow(timeZone: string, now: number = Date.now()): { day: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return { day: `${part("year")}-${part("month")}-${part("day")}`, clock: `${part("hour")}:${part("minute")}` };
}
