"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import { resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, LineDetails, useGuestCopy } from "@/features/guest/shell";
import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

export function CheckoutScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const cart = useQuery({
    queryKey: ["guest-cart", session?.sessionId],
    enabled: Boolean(session?.sessionId),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/sessions/{session_id}/cart", {
        params: { path: { session_id: session?.sessionId ?? "" } },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  const place = useMutation({
    mutationFn: async () => {
      const lines = cart.data?.items ?? [];
      const body: components["schemas"]["CheckoutRequest"] = {
        customer_notes: notes || null,
        items: lines.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
          selected_option_ids: (line.modifiers ?? []).map((modifier) => modifier.option_id),
          special_instructions: line.notes,
        })),
      };
      const result = await guestApi.POST("/api/v1/orders/checkout", { body });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
      toast.success(t.orderSent);
      router.push("/order/track");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409 && error.code === "ACTIVE_ORDER_EXISTS") {
        toast(t.activeOrderOpen);
        router.push("/order/track");
        return;
      }
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) place.mutate();
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart", {
        params: { path: { session_id: session?.sessionId ?? "" } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guest-cart"] }),
  });

  const remove = useMutation({
    mutationFn: async (cartItemId: string) => {
      const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart/items/{cart_item_id}", {
        params: { path: { session_id: session?.sessionId ?? "", cart_item_id: cartItemId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guest-cart"] }),
  });

  if (!session) return null;
  if (cart.isLoading) return <LoadingState label={t.loading} />;
  if (cart.isError) {
    return <GuestQueryError error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  const lines = cart.data?.items ?? [];

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.checkout}</h1>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.emptyCart}</p>
      ) : (
        <ul className="grid gap-3">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-medium">{line.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  {line.quantity} · {line.guest_name}
                </p>
                <LineDetails modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)} note={line.notes} />
              </div>
              <div className="text-end">
                <Money amount={line.line_total} locale={locale} />
                <button type="button" className="mt-2 block min-h-11 text-sm underline" onClick={() => remove.mutate(line.id)}>
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-lg font-semibold">
        {t.total} <Money amount={cart.data?.subtotal ?? "0.00"} locale={locale} />
      </p>
      <label className="grid gap-1 text-sm font-medium">
        {t.notes}
        <textarea className="min-h-20 rounded-lg border px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button
        type="button"
        className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={lines.length === 0 || place.isPending}
        onClick={() => place.mutate()}
      >
        {t.placeOrder}
      </button>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => clear.mutate()}>
        {t.clearCart}
      </button>
      <Link href="/order" className="text-sm underline">
        {t.backMenu}
      </Link>
    </div>
  );
}
