"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { useAbsorbBranding, useGuestCopy } from "@/features/guest/shell";
import { useGuest } from "@/stores/guest";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";

export function PickupScreen({ branchId }: { branchId: string }) {
  const { t, locale } = useGuestCopy();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [color, setColor] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [govId, setGovId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [pending, setPending] = useState(false);

  const menu = useQuery({
    queryKey: ["pickup-menu", branchId],
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/menu/branch/{branch_id}", {
        params: { path: { branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.retry, locale);
      }
      return result.data;
    },
  });

  // A stored table session may belong to another brand; start this branch clean.
  useEffect(() => {
    if (useGuest.getState().session?.branchId !== branchId) useGuest.getState().setBranding(null);
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
      payment_method: "ONLINE_PREPAID",
      customer_notes: null,
      vehicle_info: {
        color: color || null,
        model: model || null,
        plate_number: plate || null,
      },
    };
    try {
      const result = await guestApi.POST("/api/v1/orders/drive-thru", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.retry, locale);
      toast.success(`${t.orderSent} ${result.data.pickup_number ?? ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.retry);
    } finally {
      setPending(false);
    }
  }

  if (menu.isLoading) return <LoadingState label={t.loading} />;
  if (menu.isError) {
    return <ErrorState body={menu.error instanceof Error ? menu.error.message : t.retry} onRetry={() => void menu.refetch()} />;
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.pickup}</h1>
      {(menu.data?.categories ?? []).map((category) => (
        <section key={category.category_id} className="grid gap-2">
          <h2 className="font-semibold">{pickLocale(category.category_name, locale)}</h2>
          {(category.items ?? []).map((item) => (
            <label key={item.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3">
              <span>
                {pickLocale(item.name, locale)} · <Money amount={item.final_price} currency={menu.data?.currency || "EGP"} locale={locale} />
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
