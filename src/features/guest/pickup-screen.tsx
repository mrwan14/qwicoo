"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { useAbsorbBranding, useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { useGuest } from "@/stores/guest";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import { latestPickupOrder, removePickupOrder, savePickupOrder, type PickupOrderRecord } from "@/lib/guest/pickup-orders";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";

type PickupCodeState =
  | { kind: "preparing" }
  | { kind: "ready"; token: string }
  | { kind: "collected" }
  | { kind: "cancelled" }
  | { kind: "missing" };

function pickupPollingSettled(state: PickupCodeState | undefined): boolean {
  return state?.kind === "collected" || state?.kind === "cancelled" || state?.kind === "missing";
}

export function PickupScreen({ branchId }: { branchId: string }) {
  const { t, locale } = useGuestCopy();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [color, setColor] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [govId, setGovId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [pending, setPending] = useState(false);
  const [restored, setRestored] = useState(false);
  const [placed, setPlaced] = useState<PickupOrderRecord | null>(null);
  const interval = usePollingInterval(7000);

  const menu = useQuery({
    queryKey: ["pickup-menu", branchId],
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/menu/branch/{branch_id}", {
        params: { path: { branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  // A stored table session may belong to another brand; start this branch clean.
  useEffect(() => {
    if (useGuest.getState().session?.branchId !== branchId) useGuest.getState().setBranding(null);
  }, [branchId]);

  useEffect(() => {
    setPlaced(latestPickupOrder(branchId));
    setRestored(true);
  }, [branchId]);
  useAbsorbBranding(menu.data);

  const govs = useQuery({
    queryKey: ["govs"],
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/delivery/governorates");
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });

  const zones = useQuery({
    queryKey: ["zones", govId],
    enabled: Boolean(govId),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/delivery/governorates/{governorate_id}/zones", {
        params: { path: { governorate_id: govId } },
      });
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });

  const fee = useQuery({
    queryKey: ["fee", branchId, govId, zoneId],
    enabled: Boolean(govId),
    queryFn: async () => {
      const body: components["schemas"]["CalculateDeliveryFeeRequest"] = {
        branch_id: branchId,
        governorate_id: govId,
        zone_id: zoneId || null,
        order_amount: "0.00",
      };
      const result = await guestApi.POST("/api/v1/delivery/calculate-fee", { body });
      if (!result.response.ok || !result.data) return null;
      return result.data;
    },
  });

  async function place() {
    const items = Object.entries(selected)
      .filter(([, quantity]) => quantity > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity }));
    if (items.length === 0) return;
    setPending(true);
    const body: components["schemas"]["DriveThruOrderCreateSchema"] = {
      branch_id: branchId,
      items,
      fulfillment_type: "DRIVE_THRU",
      payment_method: "CASH",
      customer_notes: null,
      vehicle_info: {
        color: color || null,
        model: model || null,
        plate_number: plate || null,
      },
    };
    try {
      const result = await guestApi.POST("/api/v1/orders/drive-thru", { body });
      if (result.response.status === 429) {
        toast.error(t.orderingTooFast);
        return;
      }
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.oops, locale);
      const order = result.data;
      setPlaced(
        savePickupOrder({
          orderId: order.id,
          branchId,
          accessToken: order.order_access_token,
          expiresAt: order.order_access_token_expires_at,
          pickupNumber: order.pickup_number ?? null,
          amountDue: order.amount_due,
          currency: menu.data?.currency || "EGP",
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.oops);
    } finally {
      setPending(false);
    }
  }

  const pickupCode = useQuery({
    queryKey: ["pickup-handover", placed?.orderId],
    enabled: Boolean(placed),
    refetchInterval: (query) => (pickupPollingSettled(query.state.data) ? false : interval),
    retry: false,
    queryFn: async (): Promise<PickupCodeState> => {
      if (!placed) return { kind: "missing" };
      try {
        const result = await guestApi.GET("/api/v1/orders/{order_id}/handover-token", {
          params: {
            path: { order_id: placed.orderId },
            header: { "X-Order-Access-Token": placed.accessToken },
          },
        });
        if (result.response.status === 200 && result.data) {
          return result.data.is_used ? { kind: "collected" } : { kind: "ready", token: result.data.token };
        }
        if (result.response.status === 400) return { kind: "preparing" };
        if (result.response.status === 409) return { kind: "cancelled" };
        if (result.response.status === 404) return { kind: "missing" };
        return { kind: "preparing" };
      } catch {
        return { kind: "preparing" };
      }
    },
  });

  function placeAnother() {
    if (placed) removePickupOrder(placed.orderId);
    setPlaced(null);
    setSelected({});
  }

  const code = pickupCode.data;
  const statusLine =
    code?.kind === "cancelled" ? t.orderCancelled : code?.kind === "missing" ? t.showOrderNumber : t.preparing;

  if (!restored) return <LoadingState label={t.loading} />;

  if (placed) {
    return (
      <div className="grid gap-4">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.pickup}</h1>
        <section className="grid gap-3 rounded-xl border p-4" aria-live="polite">
          <p className="text-[length:var(--text-20)] font-medium">{t.orderSent}</p>
          {placed.pickupNumber != null ? (
            <p className="text-[length:var(--text-40)] leading-none font-semibold tabular-nums">#{placed.pickupNumber}</p>
          ) : null}
          {code?.kind === "collected" ? null : (
            <p>
              {t.payAtWindow}: <Money amount={placed.amountDue} currency={placed.currency} locale={locale} />
            </p>
          )}
          {code?.kind === "collected" ? (
            <p role="status" className="text-[length:var(--text-20)] font-medium">{t.enjoyOrder}</p>
          ) : code?.kind === "ready" ? (
            <p className="grid gap-1">
              <span className="text-sm text-muted-foreground">{t.pickupCodeReady}</span>
              <span className="text-[length:var(--text-40)] leading-none font-semibold tracking-wide break-all">{code.token}</span>
            </p>
          ) : (
            <p role="status" className="text-sm">
              {statusLine}
            </p>
          )}
          <button type="button" className="min-h-14 rounded-lg border text-sm font-medium" onClick={placeAnother}>
            {t.placeAnother}
          </button>
        </section>
      </div>
    );
  }

  if (menu.isLoading) return <LoadingState label={t.loading} />;
  if (menu.isError || !menu.data) {
    return (
      <ErrorState
        title={t.oopsTitle}
        body={menu.error instanceof Error ? menu.error.message : t.oops}
        onRetry={() => void menu.refetch()}
        retryLabel={t.retry}
      />
    );
  }

  const menuData = menu.data;

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.pickup}</h1>
      {(menuData.categories ?? []).map((category) => (
        <section key={category.category_id} className="grid gap-2">
          <h2 className="font-semibold">{pickLocale(category.category_name, locale)}</h2>
          {(category.items ?? []).map((item) => (
            <label key={item.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3">
              <span>
                {pickLocale(item.name, locale)} · <Money amount={item.final_price} currency={menuData.currency || "EGP"} locale={locale} />
              </span>
              <input
                type="number"
                min={0}
                className="h-11 w-16 rounded-lg border px-2"
                value={selected[item.id] ?? 0}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [item.id]: Number(event.target.value) || 0 }))
                }
              />
            </label>
          ))}
        </section>
      ))}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t.vehicle}</legend>
        <input className="h-12 rounded-lg border px-3" placeholder={t.color} value={color} onChange={(event) => setColor(event.target.value)} />
        <input className="h-12 rounded-lg border px-3" placeholder={t.model} value={model} onChange={(event) => setModel(event.target.value)} />
        <input className="h-12 rounded-lg border px-3" placeholder={t.plate} value={plate} onChange={(event) => setPlate(event.target.value)} />
      </fieldset>
      <label className="grid gap-1 text-sm">
        {t.fee}
        <select className="h-12 rounded-lg border px-3" value={govId} onChange={(event) => setGovId(event.target.value)}>
          <option value="">—</option>
          {(govs.data ?? []).map((gov) => (
            <option key={gov.id} value={gov.id}>
              {locale === "ar" ? gov.name_ar : gov.name_en}
            </option>
          ))}
        </select>
        <select className="h-12 rounded-lg border px-3" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
          <option value="">—</option>
          {(zones.data ?? []).map((zone) => (
            <option key={zone.id} value={zone.id}>
              {locale === "ar" ? zone.name_ar : zone.name_en}
            </option>
          ))}
        </select>
        {fee.data ? <Money amount={fee.data.delivery_fee} locale={locale} /> : null}
      </label>
      <button type="button" className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground" disabled={pending} onClick={() => void place()}>
        {t.placeOrder}
      </button>
    </div>
  );
}
