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

export async function submitGuestCart(
  sessionId: string,
  version: number,
  locale: LocaleCode,
  fallback: string,
): Promise<components["schemas"]["OrderResponse"]> {
  const headers = cartMutationHeaders(version);
  const result = await guestApi.POST("/api/v1/sessions/{session_id}/cart/submit", {
    params: { path: { session_id: sessionId }, header: headers },
  });
  if (!result.response.ok || !result.data) {
    throw asApiError(result.error, result.response, fallback, locale);
  }
  return result.data;
}
