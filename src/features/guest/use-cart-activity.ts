"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { GuestCart } from "@/features/guest/cart-client";
import { useGuestCopy } from "@/features/guest/shell";
import { useGuest } from "@/stores/guest";

/**
 * Watches shared-cart polls for lines added by other diners.
 * Flashes the cart bar and toasts "{name} added {item}" (respects reduced motion).
 */
export function useCartActivity(cart: GuestCart | undefined) {
  const { t } = useGuestCopy();
  const guestId = useGuest((state) => state.session?.guestId);
  const guestName = useGuest((state) => state.guestName);
  const previous = useRef<GuestCart | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!cart) return;
    const prior = previous.current;
    previous.current = cart;
    if (!prior) return;

    const priorById = new Map(prior.items.map((line) => [line.id, line]));
    for (const line of cart.items) {
      const before = priorById.get(line.id);
      const qtyDelta = before ? line.quantity - before.quantity : line.quantity;
      if (qtyDelta <= 0) continue;
      const mine =
        (guestId && line.guest_id && line.guest_id === guestId) ||
        (guestName.trim() &&
          (line.nickname || line.guest_name || "").trim().toLowerCase() === guestName.trim().toLowerCase());
      if (mine) continue;

      const name = (line.nickname || line.guest_name || t.guestFallback.replace("{n}", "")).trim() || "Guest";
      const message = t.someoneAdded.replace("{name}", name).replace("{item}", line.item_name);
      const reduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      toast.message(message);
      if (!reduced) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 240);
      }
      break;
    }
  }, [cart, guestId, guestName, t.guestFallback, t.someoneAdded]);

  return { flash };
}
