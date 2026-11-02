import type { Tone } from "@/components/ops/kit/badge";
import { optionalRecordString, staffOrderStatus } from "@/features/staff/delivery";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import type { ordersCopy } from "@/lib/i18n/staff/orders";
import { orderStatusLabel } from "@/lib/status-labels";

import type { StaffOrderListItem } from "./types";

type Copy = (typeof ordersCopy)["en"];

export function orderLabel(row: Pick<StaffOrderListItem, "display_number" | "pickup_number" | "id">): string {
  if (row.display_number?.trim()) return row.display_number.trim();
  if (row.pickup_number != null) return `#${row.pickup_number}`;
  return `#${row.id.slice(0, 6)}`;
}

/** "Table 9", "Takeaway", "Delivery"… */
export function placeLabel(row: Pick<StaffOrderListItem, "table_label" | "fulfillment_type">, t: Copy): string {
  if (row.table_label?.trim()) return `${t.table} ${row.table_label.trim()}`;
  switch ((row.fulfillment_type ?? "").toUpperCase()) {
    case "DELIVERY":
      return t.live.delivery;
    case "PICKUP":
    case "CURBSIDE":
      return t.live.pickup;
    case "DRIVE_THRU":
      return t.live.driveThru;
    case "TAKEAWAY":
      return t.live.takeaway;
    default:
      return t.live.dineIn;
  }
}

export function sourceLabel(source: string | null | undefined, t: Copy): string {
  const key = (source ?? "") as keyof Copy["sources"];
  return t.sources[key] ?? source ?? "";
}

/** Status badge: colour only for what needs someone (to confirm, waiting, ready). */
export function orderTone(row: StaffOrderListItem, t: Copy, locale: LocaleCode): { tone: Tone; label: string } {
  const label = staffOrderStatus({
    fulfillmentType: row.fulfillment_type,
    deliveryStatus: optionalRecordString(row, "delivery_status"),
    fallback: orderStatusLabel(row.status, locale),
    locale,
  });
  switch (row.status) {
    case "PENDING_STAFF_CONFIRMATION":
      return { tone: "warning", label: t.live.toConfirm };
    case "SUBMITTED":
      return { tone: "info", label };
    case "PREPARING":
      return { tone: "warning", label };
    case "READY":
      return { tone: "success", label };
    case "SERVED":
    case "DELIVERED":
      return row.is_paid ? { tone: "success", label } : { tone: "neutral", label: t.live.servedUnpaid };
    case "CANCELLED":
      return { tone: "danger", label };
    default:
      return { tone: "neutral", label };
  }
}
