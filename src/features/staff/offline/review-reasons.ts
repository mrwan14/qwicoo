import { fill } from "@/lib/i18n/dictionary";
import { currentLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { offlineCopy } from "@/lib/i18n/staff/offline";

/** Plain labels for the flags the API puts on offline orders. */
type Reason = Record<string, unknown>;

function money(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function reasonLabel(reason: Reason, locale?: LocaleCode): string {
  const copy = offlineCopy[locale ?? currentLocale()].reasons;
  const name = typeof reason.name === "string" && reason.name ? reason.name : copy.item;
  switch (reason.code) {
    case "OFFLINE_DISABLED":
      return copy.offlineDisabled;
    case "CLOCK_AHEAD":
      return copy.clockAhead;
    case "OFFLINE_TOO_LONG":
      return fill(copy.offlineTooLong, { hours: money(reason.max_hours) || copy.theAllowed });
    case "NO_OPEN_DRAWER":
      return copy.noOpenDrawer;
    case "DRAWER_CLOSED_BEFORE_SYNC":
      return copy.drawerClosed;
    case "TABLE_MISSING":
      return copy.tableMissing;
    case "ITEM_MISSING":
      return fill(copy.itemMissing, { name });
    case "ITEM_SOLD_OUT":
      return fill(copy.itemSoldOut, { name });
    case "PRICE_CHANGED":
      return fill(copy.priceChanged, { name, offline: money(reason.offline_price), current: money(reason.current_price) });
    case "TOTAL_MISMATCH":
      return fill(copy.totalMismatch, { device: money(reason.device_total), calculated: money(reason.calculated_total) });
    case "NO_KNOWN_ITEMS":
      return copy.noKnownItems;
    case "CASH_AMOUNT_MISMATCH":
      return fill(copy.cashMismatch, { paid: money(reason.paid), total: money(reason.total) });
    case "CANCELLED_AFTER_CLOSE":
      return copy.cancelledAfterClose;
    default:
      return typeof reason.code === "string" ? reason.code.replace(/_/g, " ").toLowerCase() : copy.needsLook;
  }
}
