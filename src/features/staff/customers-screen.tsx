"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { customersCopy } from "@/lib/i18n/staff/customers";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const field = "h-11 w-full border bg-background px-3 text-sm";

export function CustomersScreen() {
  const t = useStaffSection(customersCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const isSuper = me?.role === "SUPER_ADMIN";
  const scopedBrand = useScope((state) => state.brandId);
  const [pickedBrand, setPickedBrand] = useState<string | null>(null);
  const brandId = isSuper ? (pickedBrand ?? scopedBrand) : me?.brand_id ?? scopedBrand;
  const brands = useQuery({
    queryKey: ["brands", "qwicoo-customers"],
    enabled: isSuper,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed, locale);
      return result.data.items ?? [];
    },
  });
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ id: string; blocked: boolean } | null>(null);

  const customers = useQuery({
    queryKey: ["mobile-customers", brandId, q],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/staff/mobile-customers", {
        params: { query: { q: q || null, brand_id: brandId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed, locale);
      return result.data.items ?? [];
    },
  });

  const change = useMutation({
    mutationFn: async (input: { id: string; blocked: boolean }) => {
      const path = input.blocked
        ? "/api/v1/staff/mobile-customers/{customer_id}/block"
        : "/api/v1/staff/mobile-customers/{customer_id}/unblock";
      const result = await browserApi.POST(path, {
        params: { path: { customer_id: input.id }, query: { brand_id: brandId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.saveFailed, locale);
    },
    onSuccess: () => {
      setPending(null);
      toast.success(t.saved);
      void queryClient.invalidateQueries({ queryKey: ["mobile-customers", brandId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.hint}</p>
      </div>
      {isSuper ? (
        <label className="grid max-w-md gap-1 text-sm">
          {t.restaurant}
          <select className={field} value={brandId ?? ""} onChange={(event) => setPickedBrand(event.target.value)}>
            <option value="">{t.chooseBrand}</option>
            {(brands.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {!brandId ? <EmptyState title={t.chooseBrand} body="" /> : (
        <>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(draft.trim());
            }}
          >
            <label className="grid min-w-64 flex-1 gap-1 text-sm">
              {t.search}
              <input className={field} value={draft} placeholder={t.searchPlaceholder} onChange={(event) => setDraft(event.target.value)} />
            </label>
            <button type="submit" className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground">{t.search}</button>
          </form>
          {customers.isLoading ? <LoadingState label={t.loading} /> : null}
          {customers.isError ? <QueryErrorState error={customers.error} screen={t.title} onRetry={() => void customers.refetch()} /> : null}
          {customers.data && customers.data.length === 0 ? <EmptyState title={t.empty} body="" /> : null}
          {customers.data && customers.data.length > 0 ? (
            <ul className="grid gap-2">
              {customers.data.map((customer) => (
                <li key={customer.customer_id} className="grid gap-1 border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{customer.full_name}</p>
                    <StatusChip tone={customer.status === "blocked" ? "soldout" : "available"}>
                      {customer.status === "blocked" ? t.blocked : t.active}
                    </StatusChip>
                  </div>
                  <p className="text-muted-foreground">{customer.email} · {customer.phone}</p>
                  <p className="tabular-nums">{fill(t.orders, { count: customer.order_count })}{customer.last_order_at ? ` · ${formatCairoDateTime(customer.last_order_at, locale)}` : ""}</p>
                  <button
                    type="button"
                    className="min-h-11 w-fit border px-3"
                    onClick={() => setPending({ id: customer.customer_id, blocked: customer.status !== "blocked" })}
                  >
                    {customer.status === "blocked" ? t.unblock : t.block}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending?.blocked ? t.blockTitle : t.unblockTitle}
        description={pending?.blocked ? t.blockBody : t.unblockBody}
        confirmLabel={pending?.blocked ? t.block : t.unblock}
        destructive={pending?.blocked}
        pending={change.isPending}
        onConfirm={() => { if (pending) change.mutate(pending); }}
      />
    </div>
  );
}
