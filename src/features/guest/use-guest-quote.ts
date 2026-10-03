"use client";

import { useQuery } from "@tanstack/react-query";

import { useGuestCopy } from "@/features/guest/shell";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";

export type QuoteItemInput = components["schemas"]["OrderItemInput"];

export function useGuestOrderQuote(items: QuoteItemInput[] | null, fallback: string) {
  const { locale } = useGuestCopy();
  const key = JSON.stringify(items ?? []);
  return useQuery({
    queryKey: ["guest-quote", key],
    enabled: Boolean(items && items.length > 0),
    queryFn: async () => {
      const result = await guestApi.POST("/api/v1/orders/quote", {
        body: { items: JSON.parse(key) as QuoteItemInput[] },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, fallback, locale);
      }
      return result.data;
    },
  });
}
