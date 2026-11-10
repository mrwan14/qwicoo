"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getGuestCart, isCartConflict, nextGuestName, type GuestCartItem } from "@/features/guest/cart-client";
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

/**
 * The table cart's current version for a write. Right after joining, the shared cart may
 * already hold other guests' items, so fetch it once instead of guessing version 1.
 */
export async function latestCartVersion(
  queryClient: QueryClient,
  locale: "en" | "ar",
  fallback: string,
): Promise<number> {
  const sessionId = useGuest.getState().session?.sessionId;
  if (!sessionId) return 1;
  const cached = queryClient.getQueryData<{ version?: number }>(["guest-cart", sessionId]);
  if (cached?.version != null) return cached.version;
  const fresh = await queryClient.fetchQuery({
    queryKey: ["guest-cart", sessionId],
    queryFn: () => getGuestCart(sessionId, locale, fallback),
  });
  return fresh.version ?? 1;
}

/** Give a guest who hasn't picked a name the next free "Guest N", after loading the table's cart. */
export async function ensureGuestName(
  queryClient: QueryClient,
  locale: "en" | "ar",
  fallback: string,
  template: string,
): Promise<void> {
  if (useGuest.getState().guestName.trim()) return;
  await latestCartVersion(queryClient, locale, fallback);
  const sessionId = useGuest.getState().session?.sessionId;
  const lines = queryClient.getQueryData<{ items?: GuestCartItem[] }>(["guest-cart", sessionId])?.items ?? [];
  if (!useGuest.getState().guestName.trim()) useGuest.getState().setGuestName(nextGuestName(lines, template));
}
