"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteStock } from "./access";
import { control, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { purchaseCancel } from "./purchasing";
import { formatQty } from "./qty";

const STATUSES = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED", "CLOSED"] as const;
const PAGE = 50;

type Summary = components["schemas"]["PurchaseOrderSummary"];
type Detail = components["schemas"]["PurchaseOrderDetailResponse"];
type LineDraft = { ingredientId: string; unitId: string; qty: string; unitPrice: string };

export function PurchaseOrdersScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const branchId = useScope((state) => state.branchId) ?? "";
  const canWrite = canWriteStock(me?.role);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const orders = useQuery({
    queryKey: ["inventory", "purchase-orders", branchId, status, offset],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/purchase-orders", {
        params: {
          query: {
            branch_id: branchId,
            status: status ? [status] : null,
            limit: PAGE,
            offset,
          },
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const rows = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;

  return (
    <InventoryFrame page="purchaseOrders">
      <PageHeader
        title={t.purchaseOrders.title}
        detail={t.purchaseOrders.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.purchaseOrders.add}</button> : null}
      />
      <label className="grid max-w-xs gap-1 text-sm">
        <span className="text-muted-foreground">{t.purchaseOrders.status}</span>
        <select className={control} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
          <option value="">{t.all}</option>
          {STATUSES.map((item) => <option key={item} value={item}>{t.purchaseOrders.statuses[item]}</option>)}
        </select>
      </label>
      {orders.isLoading ? <LoadingState label={t.loading} /> : null}
      {orders.isError ? <QueryErrorState error={orders.error} screen={t.tabs.purchaseOrders} onRetry={() => void orders.refetch()} /> : null}
      {orders.data && rows.length === 0 ? <EmptyState title={t.purchaseOrders.empty} body={t.purchaseOrders.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.movements.when, t.purchaseOrders.supplier, t.purchaseOrders.status, t.purchaseOrders.lines, t.purchaseOrders.total].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <OrderRow key={order.id} order={order} currency={currency} onOpen={() => setSelected(order.id)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > PAGE ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{fill(t.purchaseOrders.page, { from: offset + 1, to: Math.min(offset + PAGE, total), total })}</span>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t.purchaseOrders.previous}</button>
            <button type="button" className={secondaryButton} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>{t.purchaseOrders.next}</button>
          </div>
        </div>
      ) : null}
      {selected ? (
        <OrderDrawer key={selected} orderId={selected} branchId={branchId} canWrite={canWrite} currency={currency} onClose={() => setSelected(null)} />
      ) : null}
    </InventoryFrame>
  );
}

function OrderRow({ order, currency, onOpen }: { order: Summary; currency: string; onOpen: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const status = STATUSES.find((item) => item === order.status);
  return (
    <tr className="cursor-pointer border-b hover:bg-muted/40" onClick={onOpen}>
      <td className="px-3 py-2 whitespace-nowrap">{formatCairoDateTime(order.created_at, locale)}</td>
      <td className="px-3 py-2">{order.supplier_name ?? ""}</td>
      <td className="px-3 py-2">{status ? t.purchaseOrders.statuses[status] : order.status}</td>
      <td className="px-3 py-2 tabular-nums">{formatQty(order.line_count ?? 0, locale)}</td>
      <td className="px-3 py-2"><Money amount={order.total_ordered_value ?? "0"} currency={currency} /></td>
    </tr>
  );
}

function OrderDrawer({
  orderId,
  branchId,
  canWrite,
  currency,
  onClose,
}: {
  orderId: string | "new";
  branchId: string;
  canWrite: boolean;
  currency: string;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["inventory", "purchase-order", orderId],
    enabled: orderId !== "new",
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/purchase-orders/{order_id}", {
        params: { path: { order_id: orderId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["inventory", "purchase-orders", branchId] });
    if (orderId !== "new") await queryClient.invalidateQueries({ queryKey: ["inventory", "purchase-order", orderId] });
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{orderId === "new" ? t.purchaseOrders.add : detail.data?.supplier_name ?? t.purchaseOrders.title}</SheetTitle>
        </SheetHeader>
        {orderId === "new" ? <CreateOrder branchId={branchId} onClose={onClose} /> : null}
        {orderId !== "new" && detail.isLoading ? <LoadingState label={t.loading} /> : null}
        {orderId !== "new" && detail.isError ? <QueryErrorState error={detail.error} screen={t.tabs.purchaseOrders} onRetry={() => void detail.refetch()} /> : null}
        {detail.data ? <OrderDetail order={detail.data} canWrite={canWrite} currency={currency} onChanged={refresh} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetail({
  order,
  canWrite,
  currency,
  onChanged,
}: {
  order: Detail;
  canWrite: boolean;
  currency: string;
  onChanged: () => Promise<void>;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const [receive, setReceive] = useState<Record<string, { qty: string; price: string }>>({});
  const receivedQty = order.lines.reduce((sum, line) => sum + Number(line.qty_received), 0);
  const cancel = purchaseCancel(order.status, receivedQty);
  const canReceive = canWrite && (order.status === "SENT" || order.status === "PARTIALLY_RECEIVED");
  const send = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/purchase-orders/{order_id}/send", {
        params: { path: { order_id: order.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const receiveOrder = useMutation({
    mutationFn: async () => {
      const lines = order.lines.flatMap((line) => {
        const qty = receive[line.id]?.qty.trim();
        if (!qty || Number(qty) <= 0) return [];
        const price = receive[line.id]?.price.trim();
        return [{ line_id: line.id, qty, unit_price: price || null }];
      });
      const result = await browserApi.POST("/api/v1/inventory/purchase-orders/{order_id}/receive", {
        params: { path: { order_id: order.id } },
        body: { lines },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); setReceive({}); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const cancelOrder = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/purchase-orders/{order_id}/cancel", {
        params: { path: { order_id: order.id } },
        body: { close_remaining: cancel?.closeRemaining ?? false, note: null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const status = STATUSES.find((item) => item === order.status);

  return (
    <div className="grid gap-4 px-4 pb-6">
      <p className="text-sm text-muted-foreground">{status ? t.purchaseOrders.statuses[status] : order.status}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {[t.ingredient, t.purchaseOrders.ordered, t.purchaseOrders.received, t.purchaseOrders.remaining, t.purchaseOrders.price].map((label) => (
                <th key={label} className="px-2 py-2 text-start font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b">
                <td className="px-2 py-2">{pickLocale(line.ingredient_name, locale) || line.ingredient_sku}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_ordered, locale)} {line.unit_code}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_received, locale)}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_remaining, locale)}</td>
                <td className="px-2 py-2"><Money amount={line.unit_price} currency={currency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canWrite && order.status === "DRAFT" ? <button type="button" className={primaryButton} disabled={send.isPending} onClick={() => send.mutate()}>{t.purchaseOrders.send}</button> : null}
      {canReceive ? (
        <div className="grid gap-2">
          <h2 className="font-medium">{t.purchaseOrders.receive}</h2>
          {order.lines.filter((line) => Number(line.qty_remaining) > 0).map((line) => (
            <div key={line.id} className="grid gap-2 border-b py-2 sm:grid-cols-2">
              <span className="text-sm">{pickLocale(line.ingredient_name, locale) || line.ingredient_sku}</span>
              <label className="grid gap-1 text-sm">
                <span>{t.purchaseOrders.receiveQty}</span>
                <input className={control} inputMode="decimal" value={receive[line.id]?.qty ?? ""} onChange={(event) => setReceive({ ...receive, [line.id]: { qty: event.target.value, price: receive[line.id]?.price ?? "" } })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t.purchaseOrders.price}</span>
                <input className={control} inputMode="decimal" value={receive[line.id]?.price ?? ""} placeholder={line.unit_price} onChange={(event) => setReceive({ ...receive, [line.id]: { qty: receive[line.id]?.qty ?? "", price: event.target.value } })} />
              </label>
            </div>
          ))}
          <button type="button" className={primaryButton} disabled={receiveOrder.isPending} onClick={() => receiveOrder.mutate()}>{t.purchaseOrders.receive}</button>
        </div>
      ) : null}
      {canWrite && cancel ? (
        <button type="button" className={secondaryButton} disabled={cancelOrder.isPending} onClick={() => cancelOrder.mutate()}>
          {cancel.closeRemaining ? t.purchaseOrders.closeRemaining : t.purchaseOrders.cancelOrder}
        </button>
      ) : null}
    </div>
  );
}

function CreateOrder({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const queryClient = useQueryClient();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ingredientId: "", unitId: "", qty: "", unitPrice: "" }]);
  const selectedWarehouse = warehouseId || warehouses.data?.find((item) => item.kind !== "CENTRAL_KITCHEN")?.id || "";
  const suppliers = useQuery({
    queryKey: ["inventory", "suppliers", brandId, false],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers", {
        params: { query: { brand_id: brandId, include_inactive: false } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "active"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: true } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const packs = useQuery({
    queryKey: ["inventory", "supplier", supplierId],
    enabled: Boolean(supplierId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers/{supplier_id}", {
        params: { path: { supplier_id: supplierId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.packs ?? [];
    },
  });
  const suggest = useMutation({
    mutationFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/purchase-suggestions", {
        params: { path: { warehouse_id: selectedWarehouse } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
    onSuccess: (items) => {
      const next = items.filter((item) => Number(item.suggested_qty) > 0).map((item) => {
        const pack = (packs.data ?? []).find((row) => row.ingredient_id === item.ingredient_id);
        const ingredient = (ingredients.data ?? []).find((row) => row.id === item.ingredient_id);
        return {
          ingredientId: item.ingredient_id,
          unitId: pack?.pack_unit_id ?? ingredient?.base_unit_id ?? "",
          qty: item.suggested_qty,
          unitPrice: pack?.last_price ?? "",
        };
      });
      if (next.length) setLines(next);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/purchase-orders", {
        body: {
          warehouse_id: selectedWarehouse,
          supplier_id: supplierId,
          lines: lines.map((line) => ({
            ingredient_id: line.ingredientId,
            unit_id: line.unitId,
            qty: line.qty,
            unit_price: line.unitPrice,
          })),
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "purchase-orders", branchId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  function update(index: number, patch: Partial<LineDraft>) {
    setLines(lines.map((line, item) => item === index ? { ...line, ...patch } : line));
  }

  return (
    <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      {warehouses.data ? <WarehouseSelect warehouses={warehouses.data.filter((item) => item.kind !== "CENTRAL_KITCHEN")} value={selectedWarehouse} onChange={setWarehouseId} /> : null}
      <label className="grid gap-1 text-sm">
        <span>{t.purchaseOrders.supplier}</span>
        <select className={control} value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
          <option value="">{t.purchaseOrders.supplier}</option>
          {(suppliers.data ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
      <button type="button" className={secondaryButton} disabled={!selectedWarehouse || suggest.isPending} onClick={() => suggest.mutate()}>{t.purchaseOrders.suggest}</button>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 border-b py-2">
          <select className={control} value={line.ingredientId} onChange={(event) => update(index, { ingredientId: event.target.value })} required>
            <option value="">{t.ingredient}</option>
            {(ingredients.data ?? []).map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </select>
          <select className={control} value={line.unitId} onChange={(event) => update(index, { unitId: event.target.value })} required>
            <option value="">{t.unit}</option>
            {(units.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
          </select>
          <input className={control} inputMode="decimal" placeholder={t.quantity} value={line.qty} onChange={(event) => update(index, { qty: event.target.value })} required />
          <input className={control} inputMode="decimal" placeholder={t.purchaseOrders.price} value={line.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} required />
        </div>
      ))}
      <button type="button" className={secondaryButton} onClick={() => setLines([...lines, { ingredientId: "", unitId: "", qty: "", unitPrice: "" }])}>{t.recipes.addLine}</button>
      <button type="submit" className={primaryButton} disabled={save.isPending || !selectedWarehouse || !supplierId}>{t.save}</button>
    </form>
  );
}
