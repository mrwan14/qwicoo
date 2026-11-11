import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export type ServiceRequestType = components["schemas"]["ServiceRequestType"];

const WAITER_REASONS: ServiceRequestType[] = [
  "WAITER_CALL",
  "WATER",
  "WATER_REFILL",
  "CUTLERY",
  "NAPKINS",
  "PLATES",
  "PACK_LEFTOVERS",
  "OTHER",
];

export const waiterReasonTypes = WAITER_REASONS;

export async function createGuestServiceRequest(
  requestType: ServiceRequestType,
  note: string | null,
  locale: LocaleCode,
  fallback: string,
) {
  const body: components["schemas"]["CreateServiceRequest"] = {
    request_type: requestType,
    note: note?.trim() || null,
  };
  const result = await guestApi.POST("/api/v1/service-requests", { body });
  if (!result.response.ok) throw asApiError(result.error, result.response, fallback, locale);
  return result.data;
}

/** The table's open requests. Fails loudly so the Help screen can offer Retry instead of an empty list. */
export async function fetchActiveServiceRequests(fallback = "Something went wrong") {
  const result = await guestApi.GET("/api/v1/service-requests/table/active");
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, fallback);
  return result.data;
}

export function hasOpenRequest(
  requests: readonly { request_type: ServiceRequestType; status: string }[],
  type: ServiceRequestType,
) {
  return requests.some(
    (request) =>
      request.request_type === type &&
      (request.status === "PENDING" || request.status === "ACKNOWLEDGED"),
  );
}
