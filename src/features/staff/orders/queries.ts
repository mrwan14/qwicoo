import { parseDeliveryOrders } from "@/features/staff/delivery";
import { cairoDate, isOpenOrder } from "@/features/staff/home/numbers";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { LocaleCode } from "@/lib/i18n/locale-text";

import type { StaffOrderListItem, StaffOrderListResponse } from "./types";

/** Shared by the Orders tabs and their screens, so a tab count never costs a second request. */

const PAGE = 50;
const MAX_PAGES = 6;

export function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function liveOrdersQuery(branchId: string | null, today: string, failed: string, locale: LocaleCode) {
  return {
    queryKey: ["orders-live", branchId, today] as const,
    enabled: Boolean(branchId),
    queryFn: async () => {
      const items: StaffOrderListItem[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await browserApi.GET("/api/v1/orders", {
          params: { query: { date_from: dayBefore(today), date_to: today, limit: PAGE, cursor } },
        });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed, locale);
        const data = result.data as StaffOrderListResponse;
        items.push(...data.items);
        cursor = data.next_cursor ?? null;
        if (!cursor) break;
      }
      // Every order still open, however old: an unpaid table from last week must still show here,
      // not only hold its table on the floor.
      const seen = new Set(items.map((item) => item.id));
      cursor = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await browserApi.GET("/api/v1/orders", { params: { query: { open_only: true, limit: PAGE, cursor } } });
        // An older server ignores open_only and lists today again; duplicates are skipped below.
        if (!result.response.ok || !result.data) break;
        const data = result.data as StaffOrderListResponse;
        for (const item of data.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            items.push(item);
          }
        }
        cursor = data.next_cursor ?? null;
        if (!cursor) break;
      }
      // Yesterday's orders only while still open: a table seated at 23:30 is still live after midnight.
      return items.filter((item) => cairoDate(new Date(item.created_at)) === today || isOpenOrder(item));
    },
  };
}

/** The Cairo day before a YYYY-MM-DD. */
export function dayBefore(day: string): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}

export function pendingPaymentsQuery(branchId: string | null, failed: string, locale: LocaleCode) {
  return {
    queryKey: ["payments-pending", branchId] as const,
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/payments/branch/pending");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed, locale);
      return result.data;
    },
  };
}

export function deliveryBoardQuery(branchId: string | null, failed: string, locale: LocaleCode) {
  return {
    queryKey: ["delivery-board", branchId] as const,
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders/delivery");
      if (!result.response.ok) throw asApiError(result.error, result.response, failed, locale);
      return parseDeliveryOrders(result.data);
    },
  };
}
