"use client";

import { useQuery } from "@tanstack/react-query";

import { useGuestCopy } from "@/features/guest/shell";
import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

export type QuoteItemInput = components["schemas"]["OrderItemInput"];

/** undefined leaves promo_code off the body. null sends an empty code. */
function quotedPromo(promoCode: string | null | undefined): string | null | undefined {
  if (promoCode === undefined) return undefined;
  return promoCode?.trim() || null;
}

/**
 * Price the guest cart from POST /orders/quote.
 * Only guest checkout passes promoCode. Tax and the service fee stay on the quote.
 */
export function useGuestOrderQuote(
  items: QuoteItemInput[] | null,
  fallback: string,
  promoCode?: string | null,
) {
  const { locale } = useGuestCopy();
  // Prices are quoted for a joined table; before that the menu shows list prices.
  const joined = useGuest((state) => Boolean(state.session));
  const key = JSON.stringify(items ?? []);
  const promo = quotedPromo(promoCode);
  return useQuery({
    queryKey: ["guest-quote", key, promo === undefined ? "omit" : promo],
    enabled: joined && Boolean(items && items.length > 0),
    // A refused promo code or item (4xx) won't change on retry; show it now instead of after ~7 s.
    retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 3,
    queryFn: async () => {
      const body: components["schemas"]["app__schemas__order__CheckoutRequest"] = {
        items: JSON.parse(key) as QuoteItemInput[],
      };
      if (promo !== undefined) body.promo_code = promo;
      const result = await guestApi.POST("/api/v1/orders/quote", { body });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, fallback, locale);
      }
      return result.data;
    },
  });
}
