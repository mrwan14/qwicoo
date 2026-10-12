"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteStock } from "./access";
import { countReview } from "./counts";
import { control, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty } from "./qty";

const STATUSES = ["OPEN", "SUBMITTED", "POSTED"] as const;
type Detail = components["schemas"]["CountDetailResponse"];

export function CountsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const brandId = useScope((state) => state.brandId) ?? "";
  const preset = useSearchParams().get("ingredient") ?? "";
  const canPost = canWriteStock(me?.role);
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | "new" | null>(preset ? "new" : null);
  const selectedWarehouse = warehouseId || warehouses.data?.[0]?.id || "";
  const counts = useQuery({
    queryKey: ["inventory", "counts", selectedWarehouse, status],
    enabled: Boolean(selectedWarehouse),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/counts", {
        params: { path: { warehouse_id: selectedWarehouse }, query: { status: status || null, limit: 50 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  return (
    <InventoryFrame page="counts">
      <PageHeader
        title={t.counts.title}
        detail={t.counts.detail}
        action={<button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.counts.start}</button>}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {warehouses.data ? <WarehouseSelect warehouses={warehouses.data} value={selectedWarehouse} onChange={setWarehouseId} /> : null}
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.purchaseOrders.status}</span>
          <select className={control} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t.all}</option>
            {STATUSES.map((item) => <option key={item} value={item}>{t.counts.statuses[item]}</option>)}
          </select>
        </label>
      </div>
      {counts.isLoading ? <LoadingState label={t.loading} /> : null}
      {counts.isError ? <QueryErrorState error={counts.error} screen={t.tabs.counts} onRetry={() => void counts.refetch()} /> : null}
      {counts.data && counts.data.length === 0 ? <EmptyState title={t.counts.empty} body={t.counts.detail} /> : null}
      {counts.data && counts.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.movements.when, t.counts.kinds.FULL, t.purchaseOrders.status, t.purchaseOrders.lines].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counts.data.map((count) => {
                const kind = count.kind === "PARTIAL" ? "PARTIAL" : "FULL";
                const state = STATUSES.find((item) => item === count.status);
                return (
                  <tr key={count.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setSelected(count.id)}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatCairoDateTime(count.created_at, locale)}</td>
                    <td className="px-3 py-2">{t.counts.kinds[kind]}</td>
                    <td className="px-3 py-2">{state ? t.counts.statuses[state] : count.status}</td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(count.line_count ?? 0, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {selected ? (
        <CountDrawer
          key={selected}
          countId={selected}
          warehouseId={selectedWarehouse}
          brandId={brandId}
          presetIngredient={preset}
          canPost={canPost}
          currency={currency}
          onStarted={(id) => setSelected(id)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function CountDrawer({
  countId,
  warehouseId,
  brandId,
  presetIngredient,
  canPost,
  currency,
  onStarted,
  onClose,
}: {
  countId: string | "new";
  warehouseId: string;
  brandId: string;
  presetIngredient: string;
  canPost: boolean;
  currency: string;
  onStarted: (id: string) => void;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["inventory", "count", countId],
    enabled: countId !== "new",
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/counts/{count_id}", {
        params: { path: { count_id: countId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["inventory", "counts", warehouseId] });
    if (countId !== "new") await queryClient.invalidateQueries({ queryKey: ["inventory", "count", countId] });
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{countId === "new" ? t.counts.start : t.counts.title}</SheetTitle>
        </SheetHeader>
        {countId === "new" ? (
          <StartCount warehouseId={warehouseId} brandId={brandId} presetIngredient={presetIngredient} onStarted={onStarted} />
        ) : null}
        {detail.isLoading ? <LoadingState label={t.loading} /> : null}
        {detail.isError ? <QueryErrorState error={detail.error} screen={t.tabs.counts} onRetry={() => void detail.refetch()} /> : null}
        {detail.data ? <CountSheet count={detail.data} canPost={canPost} currency={currency} onChanged={refresh} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function StartCount({
  warehouseId,
  brandId,
  presetIngredient,
  onStarted,
}: {
  warehouseId: string;
  brandId: string;
  presetIngredient: string;
  onStarted: (id: string) => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"FULL" | "PARTIAL">(presetIngredient ? "PARTIAL" : "FULL");
  const [picked, setPicked] = useState<string[]>(presetIngredient ? [presetIngredient] : []);
  const [query, setQuery] = useState("");
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "active"],
    enabled: kind === "PARTIAL" && Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: true } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (ingredients.data ?? []).filter((item) => !needle || pickLocale(item.name, locale).toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle));
  }, [ingredients.data, locale, query]);
  const start = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/counts", {
        params: { path: { warehouse_id: warehouseId } },
        body: { kind, ingredient_ids: kind === "PARTIAL" ? picked : null },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.id;
    },
    onSuccess: async (id) => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "counts", warehouseId] });
      onStarted(id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); start.mutate(); }}>
      <div className="flex gap-2">
        <button type="button" className={kind === "FULL" ? primaryButton : secondaryButton} onClick={() => setKind("FULL")}>{t.counts.full}</button>
        <button type="button" className={kind === "PARTIAL" ? primaryButton : secondaryButton} onClick={() => setKind("PARTIAL")}>{t.counts.partial}</button>
      </div>
      {kind === "PARTIAL" ? (
        <div className="grid gap-2">
          <input className={control} value={query} placeholder={t.search} onChange={(event) => setQuery(event.target.value)} />
          <div className="grid max-h-64 gap-1 overflow-y-auto">
            {visible.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(item.id)}
                  onChange={(event) => setPicked(event.target.checked ? [...picked, item.id] : picked.filter((id) => id !== item.id))}
                />
                {pickLocale(item.name, locale)}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <button type="submit" className={`${primaryButton} h-14`} disabled={start.isPending || !warehouseId || (kind === "PARTIAL" && picked.length === 0)}>{t.counts.start}</button>
    </form>
  );
}

function CountSheet({
  count,
  canPost,
  currency,
  onChanged,
}: {
  count: Detail;
  canPost: boolean;
  currency: string;
  onChanged: () => Promise<void>;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(count.lines.map((line) => [line.ingredient_id, line.counted_qty ?? ""])));
  const submit = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/counts/{count_id}/submit", {
        params: { path: { count_id: count.id } },
        body: { lines: count.lines.map((line) => ({ ingredient_id: line.ingredient_id, counted_qty: qty[line.ingredient_id] || "0" })) },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const post = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/counts/{count_id}/post", {
        params: { path: { count_id: count.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const open = count.status === "OPEN";

  return (
    <div className="grid gap-3 px-4 pb-6">
      <p className="text-sm"><Money amount={count.total_variance_value} currency={currency} /> · {t.counts.value}</p>
      {count.lines.map((line) => {
        const review = countReview(line);
        return (
          <div key={line.id} className="grid gap-2 border-b py-3">
            <div className="font-medium">{line.ingredient_sku}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>{t.counts.expected}</span><span className="tabular-nums">{formatQty(review.expected, locale)}</span>
              <span>{t.counts.counted}</span>
              {open ? (
                <input className={`${control} h-14 text-lg`} inputMode="decimal" value={qty[line.ingredient_id] ?? ""} onChange={(event) => setQty({ ...qty, [line.ingredient_id]: event.target.value })} />
              ) : <span className="tabular-nums">{review.counted == null ? "—" : formatQty(review.counted, locale)}</span>}
              <span>{t.counts.variance}</span><span className="tabular-nums">{review.varianceQty == null ? "—" : formatQty(review.varianceQty, locale)}</span>
              <span>{t.counts.value}</span><span>{review.varianceValue == null ? "—" : <Money amount={review.varianceValue} currency={currency} />}</span>
            </div>
          </div>
        );
      })}
      {open ? <button type="button" className={`${primaryButton} h-14`} disabled={submit.isPending} onClick={() => submit.mutate()}>{t.counts.submit}</button> : null}
      {canPost && count.status === "SUBMITTED" ? <button type="button" className={primaryButton} disabled={post.isPending} onClick={() => post.mutate()}>{t.counts.post}</button> : null}
    </div>
  );
}
