"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getGuestCart, isCartConflict } from "@/features/guest/cart-client";
import { useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { useGuest } from "@/stores/guest";

const CART_POLL_MS = 2500;

/**
 * Shared table cart with 2.5s polling (paused when the tab is hidden).
 * CART_UPDATED is not in the guest OpenAPI contract, so we rely on poll only.
 */
export function useSharedCart() {
  const { t, locale } = useGuestCopy();
  const sessionId = useGuest((state) => state.session?.sessionId);
  const interval = usePollingInterval(CART_POLL_MS);
  const queryClient = useQueryClient();
  const [remoteNote, setRemoteNote] = useState(false);

  const cart = useQuery({
    queryKey: ["guest-cart", sessionId],
    enabled: Boolean(sessionId),
    refetchInterval: interval,
    queryFn: async () => {
      if (!sessionId) throw new Error(t.oops);
      return getGuestCart(sessionId, locale, t.oops);
    },
  });

  async function noteConflict(error: unknown) {
    if (!isCartConflict(error)) return false;
    setRemoteNote(true);
    await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
    return true;
  }

  function dismissRemoteNote() {
    setRemoteNote(false);
  }

  return {
    cart,
    version: cart.data?.version ?? 1,
    remoteNote,
    dismissRemoteNote,
    noteConflict,
  };
}
