import { currentLocale } from "@/lib/i18n/locale-store";
import { analyticsCopy } from "@/lib/i18n/staff/analytics";

const ENDING_KEYS = [
  "ATTENDANCE_CHECK-IN",
  "ATTENDANCE_CHECK-OUT",
  "MANUAL-OVERRIDE",
  "Z-REPORT_GENERATE",
  "DRAWER_OPEN",
  "DRAWER_CLOSE",
  "ORDERS_CHECKOUT",
  "EXPO-NOTES",
  "EXPO-BUMP",
  "HANDOVER_VERIFY",
  "OFFLINE_REQUEST",
  "ONLINE_INITIATE",
] as const;

function copy() {
  return analyticsCopy[currentLocale()].audit;
}

function routeKey(action: string): string {
  return action
    .trim()
    .toUpperCase()
    .replace(/^HTTP_(POST|PUT|PATCH|DELETE|GET)_/, "")
    .replace(/^API_V1_/, "");
}

function humanize(key: string, empty: string): string {
  const cleaned = key
    .replace(/\{[^}]+\}/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return empty;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Plain name for an audit action. The stored code is unchanged. */
export function auditActionLabel(action: string | null | undefined): string {
  const labels = copy();
  const raw = action?.trim();
  if (!raw) return labels.recorded;
  const upper = raw.toUpperCase();
  if (upper in labels.named) return labels.named[upper as keyof typeof labels.named];
  const key = routeKey(raw);
  if (key in labels.named) return labels.named[key as keyof typeof labels.named];
  const known = ENDING_KEYS.find((ending) => key.endsWith(ending));
  if (known) return labels.endings[known];
  if (key.includes("_STATIONS_") && key.endsWith("_BUMP")) return labels.stationReady;
  if (key.endsWith("_BUMP")) return labels.dishReady;
  if (key.endsWith("_VERIFY")) return labels.confirmedPayment;
  if (key.includes("WEBHOOKS_")) return labels.cardUpdate;
  if (key.endsWith("_CANCEL")) return labels.cancelledOrder;
  if (key.endsWith("_TRANSITION")) return labels.updatedOrder;
  if (key.endsWith("_ARRIVED")) return labels.guestArrived;
  return humanize(key, labels.recorded);
}

export function auditStatusLabel(status: string | null | undefined): string {
  const labels = copy();
  const raw = status?.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper in labels.status) return labels.status[upper as keyof typeof labels.status];
  return humanize(raw, labels.recorded);
}
