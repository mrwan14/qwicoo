import type { components } from "@/lib/api/schema";
import { currentLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { statusCopy } from "@/lib/i18n/staff/status";

type OrderStatus = components["schemas"]["OrderStatus"];
type PaymentStatus = components["schemas"]["PaymentStatus"];
type PaymentMethod = components["schemas"]["PaymentMethod"];
type Occupancy = components["schemas"]["TableOccupancyState"];
type KitchenStation = components["schemas"]["KitchenStation"];

function fromMap<T extends string>(map: Record<T, string>, value: string | null | undefined, empty: string): string {
  if (!value) return empty;
  return map[value as T] ?? value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function labels(locale?: LocaleCode) {
  return statusCopy[locale ?? currentLocale()];
}

export function orderStatusLabel(status: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.order as Record<OrderStatus, string>, status, copy.none);
}

export function paymentStatusLabel(status: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.payment as Record<PaymentStatus, string>, status, copy.none);
}

export function paymentMethodLabel(method: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.method as Record<PaymentMethod, string>, method, copy.none);
}

/** Paymob rows use their own status words. Cash and other tenders keep the shared labels. */
export function paymobPaymentStatusLabel(status: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.paymobStatus as Record<PaymentStatus, string>, status, copy.none);
}

export function receiptPaymentCaption(
  payment: { method: string; status: string; reference?: string | null; transaction_reference?: string | null },
  locale?: LocaleCode,
): string {
  const method = paymentMethodLabel(payment.method, locale);
  if (payment.method !== "PAYMOB") return `${method} · ${paymentStatusLabel(payment.status, locale)}`;
  const reference = (payment.reference ?? payment.transaction_reference ?? "").trim();
  return `${method} · ${paymobPaymentStatusLabel(payment.status, locale)} · ${reference || "—"}`;
}

export function occupancyLabel(state: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.occupancy as Record<Occupancy, string>, state, copy.none);
}

export function stationLabel(station: string | null | undefined, locale?: LocaleCode): string {
  const copy = labels(locale);
  return fromMap(copy.station as Record<KitchenStation, string>, station, copy.kitchen);
}
