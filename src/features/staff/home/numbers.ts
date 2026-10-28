/** Pure helpers for the Home screens. Amounts are API decimal strings; sums are for charts only. */

const CAIRO = "Africa/Cairo";

export function cairoHour(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(hour) % 24;
}

/** YYYY-MM-DD in Cairo, `daysAgo` days before `now`. */
export function cairoDate(now: Date, daysAgo = 0): string {
  const shifted = new Date(now.getTime() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO, year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}

export type HourBucket = { hour: number; total: number; orders: number };

type OrderLike = { created_at: string; total_amount: string; is_paid: boolean; status: string };

/** Paid, not cancelled orders by the Cairo hour they were placed. Runs from 08:00 (or the first sale) to now. */
export function salesByHour(orders: readonly OrderLike[], nowHour: number): HourBucket[] {
  const buckets = new Map<number, HourBucket>();
  for (const order of orders) {
    if (!order.is_paid || order.status === "CANCELLED") continue;
    const hour = cairoHour(order.created_at);
    const amount = Number(order.total_amount);
    if (hour === null || !Number.isFinite(amount)) continue;
    const bucket = buckets.get(hour) ?? { hour, total: 0, orders: 0 };
    bucket.total += amount;
    bucket.orders += 1;
    buckets.set(hour, bucket);
  }
  const hours = [...buckets.keys()];
  const start = Math.min(8, ...hours);
  const end = Math.max(nowHour, ...hours, start);
  const result: HourBucket[] = [];
  for (let hour = start; hour <= end; hour += 1) result.push(buckets.get(hour) ?? { hour, total: 0, orders: 0 });
  return result;
}

/** Whole-number percent change, or null when there is nothing to compare with. */
export function percentChange(current: string | number | null | undefined, previous: string | number | null | undefined): number | null {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export function signedPercent(change: number): string {
  if (change > 0) return `+${change}%`;
  if (change < 0) return `−${Math.abs(change)}%`;
  return "0%";
}

export function minutesSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 60_000));
}

export function greetingKey(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Orders still in motion: placed and not yet paid off, closed or cancelled. */
const OPEN = new Set(["PENDING_STAFF_CONFIRMATION", "SUBMITTED", "PREPARING", "READY", "SERVED", "DELIVERED"]);
const IN_KITCHEN = new Set(["SUBMITTED", "PREPARING"]);

export function isOpenOrder(order: { status: string; is_paid: boolean }): boolean {
  if (!OPEN.has(order.status)) return false;
  return !(order.is_paid && (order.status === "SERVED" || order.status === "DELIVERED"));
}

export function isWaitingForKitchen(order: { status: string }): boolean {
  return IN_KITCHEN.has(order.status);
}

/** "08:02" in Cairo time, Western digits in both languages. */
export function cairoTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: CAIRO,
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  }).format(date);
}

/** "Monday 27 October" in Cairo time. */
export function cairoLongDate(now: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: CAIRO,
    weekday: "long",
    day: "numeric",
    month: "long",
    numberingSystem: "latn",
  }).format(now);
}

export function cairoWeekday(now: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { timeZone: CAIRO, weekday: "long" }).format(now);
}
