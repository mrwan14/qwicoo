import type { LocaleCode } from "@/lib/i18n/locale-text";

const NUMBERING = "latn" as const;

function numberLocale(locale: string): string {
  if (locale === "ar" || locale.startsWith("ar")) return "ar-EG";
  return locale || "en";
}

/** Inventory quantities. Western digits in both languages, up to 4 decimal places. */
export function formatQty(amount: string | number, locale: LocaleCode | string = "en"): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return new Intl.NumberFormat(numberLocale(locale), {
    numberingSystem: NUMBERING,
    maximumFractionDigits: 4,
  }).format(value);
}

export function lineValue(onHand: string, avgCost: string): string {
  const qty = Number(onHand);
  const cost = Number(avgCost);
  if (!Number.isFinite(qty) || !Number.isFinite(cost)) return "0.00";
  return (qty * cost).toFixed(2);
}

/** Cairo calendar day, `YYYY-MM-DD`. */
export function cairoCalendarDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Inclusive calendar days as an API window: start inclusive, end exclusive, Cairo midnights. */
export function cairoInclusiveRange(startDay: string, endDay: string): { start: string; end: string } {
  return {
    start: zonedMidnight(startDay).toISOString(),
    end: zonedMidnight(addDays(endDay, 1)).toISOString(),
  };
}

/** Cairo calendar day as an inclusive start and exclusive end, in UTC ISO. */
export function cairoDayWindow(now = new Date()): { start: string; end: string } {
  return cairoInclusiveRange(cairoCalendarDay(now), cairoCalendarDay(now));
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, (date ?? 1) + days)).toISOString().slice(0, 10);
}

function cairoParts(date: Date): { day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { day: `${pick("year")}-${pick("month")}-${pick("day")}`, hour: pick("hour"), minute: pick("minute") };
}

function zonedMidnight(day: string): Date {
  let t = Date.parse(`${day}T00:00:00Z`);
  for (let i = 0; i < 4; i += 1) {
    const shown = cairoParts(new Date(t));
    const minutes = Number(shown.hour) * 60 + Number(shown.minute);
    if (shown.day === day && minutes === 0) return new Date(t);
    const target = Date.parse(`${day}T00:00:00Z`);
    const actual = Date.parse(`${shown.day}T${shown.hour}:${shown.minute}:00Z`);
    t += target - actual;
  }
  return new Date(t);
}
