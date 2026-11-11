import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export type GuestCart = components["schemas"]["CartResponse"];
export type GuestCartItem = components["schemas"]["CartItemResponse"];
export type AddCartItemBody = components["schemas"]["AddCartItemRequest"];

export type CartLineGroup = {
  guestName: string;
  lines: GuestCartItem[];
};

/** Headers required by shared-cart mutations (optimistic concurrency + idempotency). */
export function cartMutationHeaders(version: number): {
  "If-Match": string;
  "Idempotency-Key": string;
} {
  return {
    "If-Match": String(version),
    "Idempotency-Key": crypto.randomUUID(),
  };
}

export function isCartConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === "CART_VERSION_CONFLICT" || error.code === "CART_SUBMIT_CONFLICT")
  );
}

/** Group cart lines by diner nickname for the confirm-order step. */
export function groupCartLinesByGuest(items: readonly GuestCartItem[]): CartLineGroup[] {
  const order: string[] = [];
  const byName = new Map<string, GuestCartItem[]>();
  for (const line of items) {
    const guestName = (line.nickname || line.guest_name || "Guest").trim() || "Guest";
    if (!byName.has(guestName)) {
      byName.set(guestName, []);
      order.push(guestName);
    }
    byName.get(guestName)!.push(line);
  }
  return order.map((guestName) => ({ guestName, lines: byName.get(guestName)! }));
}

export async function getGuestCart(
  sessionId: string,
  locale: LocaleCode,
  fallback: string,
): Promise<GuestCart> {
  const result = await guestApi.GET("/api/v1/sessions/{session_id}/cart", {
    params: { path: { session_id: sessionId } },
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

export async function addGuestCartItem(
  sessionId: string,
  version: number,
  body: AddCartItemBody,
  locale: LocaleCode,
  fallback: string,
): Promise<GuestCart> {
  const headers = cartMutationHeaders(version);
  const result = await guestApi.POST("/api/v1/sessions/{session_id}/cart/items", {
    params: { path: { session_id: sessionId }, header: headers },
    body,
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

export async function removeGuestCartItem(
  sessionId: string,
  cartItemId: string,
  version: number,
  locale: LocaleCode,
  fallback: string,
): Promise<GuestCart> {
  const headers = cartMutationHeaders(version);
  const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart/items/{cart_item_id}", {
    params: {
      path: { session_id: sessionId, cart_item_id: cartItemId },
      header: headers,
    },
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

/** Change quantity on an existing cart line (shared-cart PATCH). */
export async function patchGuestCartItem(
  sessionId: string,
  cartItemId: string,
  version: number,
  quantity: number,
  locale: LocaleCode,
  fallback: string,
): Promise<GuestCart> {
  const headers = cartMutationHeaders(version);
  const result = await guestApi.PATCH("/api/v1/sessions/{session_id}/cart/items/{cart_item_id}", {
    params: {
      path: { session_id: sessionId, cart_item_id: cartItemId },
      header: headers,
    },
    body: { quantity },
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

export async function clearGuestCart(
  sessionId: string,
  version: number,
  locale: LocaleCode,
  fallback: string,
): Promise<GuestCart> {
  const headers = cartMutationHeaders(version);
  const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart", {
    params: { path: { session_id: sessionId }, header: headers },
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

/** `promoCode` is the code the quote accepted; the server checks it again and applies the same discount. */
export async function submitGuestCart(
  sessionId: string,
  version: number,
  locale: LocaleCode,
  fallback: string,
  promoCode?: string | null,
  customerNotes?: string | null,
): Promise<components["schemas"]["OrderResponse"]> {
  const headers = cartMutationHeaders(version);
  const code = promoCode?.trim();
  const notes = customerNotes?.trim().slice(0, 500);
  // customer_notes is newer than the generated schema; the API accepts it on cart/submit.
  const body = { ...(code ? { promo_code: code } : {}), ...(notes ? { customer_notes: notes } : {}) };
  const result = await guestApi.POST("/api/v1/sessions/{session_id}/cart/submit", {
    params: { path: { session_id: sessionId }, header: headers },
    ...(Object.keys(body).length > 0 ? { body: body as { promo_code?: string | null } } : {}),
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}

/**
 * Whether a cart line is this diner's. When both sides carry a guest id, only the id decides,
 * so two diners who happen to share a name never see each other's lines as their own.
 */
export function lineBelongsToGuest(line: GuestCartItem, guestId: string | null, guestName: string): boolean {
  if (guestId && line.guest_id) return line.guest_id === guestId;
  const name = guestName.trim().toLowerCase();
  if (!name) return false;
  return (line.nickname || line.guest_name || "").trim().toLowerCase() === name;
}

/** The lowest "Guest N" nobody at the table is using yet. */
export function nextGuestName(lines: readonly GuestCartItem[], template: string): string {
  const taken = new Set(lines.map((line) => (line.nickname || line.guest_name || "").trim().toLowerCase()));
  let n = 1;
  while (taken.has(template.replace("{n}", String(n)).toLowerCase())) n += 1;
  return template.replace("{n}", String(n));
}
