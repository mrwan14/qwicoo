"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
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

import { canOpenInventoryPage, canWriteStock } from "./access";
import { BillSheet, NewBillSheet } from "./bills-screen";
import { control, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency, useClearLink } from "./chrome";
import { purchaseCancel } from "./purchasing";
import { NewOrderPanel, type OrderPrefill } from "./order-panel";
import { formatQty } from "./qty";

const STATUSES = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED", "CLOSED"] as const;
const PAGE = 50;

type Summary = components["schemas"]["PurchaseOrderSummary"];
type Detail = components["schemas"]["PurchaseOrderDetailResponse"];

export function PurchaseOrdersScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const branchId = useScope((state) => state.branchId) ?? "";
  const canWrite = canWriteStock(me?.role);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  // The Stock page links here with ?new=1, plus either suggest=1 or one ingredient and amount.
  const params = useSearchParams();
  const [prefill] = useState<OrderPrefill>(() => ({
    suggest: params.get("suggest") === "1",
    ingredientId: params.get("ingredient") ?? "",
    qty: params.get("qty") ?? "",
  }));
  const [selected, setSelected] = useState<string | "new" | null>(params.get("new") === "1" && canWrite ? "new" : null);
  const clearLink = useClearLink();
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
        <span className="text-ink-secondary">{t.purchaseOrders.status}</span>
        <select className={control} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
          <option value="">{t.all}</option>
          {STATUSES.map((item) => <option key={item} value={item}>{t.purchaseOrders.statuses[item]}</option>)}
        </select>
      </label>
      {orders.isLoading ? <LoadingState label={t.loading} /> : null}
      {orders.isError ? <QueryErrorState error={orders.error} screen={t.tabs.purchaseOrders} onRetry={() => void orders.refetch()} /> : null}
      {orders.data && rows.length === 0 ? <EmptyState title={t.purchaseOrders.empty} body={t.purchaseOrders.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-canvas">
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
        <OrderDrawer key={selected} orderId={selected} branchId={branchId} canWrite={canWrite} currency={currency} prefill={prefill} onClose={() => {
            setSelected(null);
            clearLink();
          }} />
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
  prefill,
  onClose,
}: {
  orderId: string | "new";
  branchId: string;
  canWrite: boolean;
  currency: string;
  prefill: OrderPrefill;
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

  if (orderId === "new") return <NewOrderPanel branchId={branchId} prefill={prefill} onClose={onClose} />;
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{orderId === "new" ? t.purchaseOrders.add : detail.data?.supplier_name ?? t.purchaseOrders.title}</SheetTitle>
        </SheetHeader>
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
  const me = useStaffSession();
  const canBill = canOpenInventoryPage(me?.role, "bills");
  const [receive, setReceive] = useState<Record<string, { qty: string; price: string }>>({});
  // The delivery just received, offered for its supplier bill.
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [billing, setBilling] = useState(false);
  const [openBill, setOpenBill] = useState<string | null>(null);
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.receipt_id;
    },
    onSuccess: async (receipt) => { toast.success(t.saved); setReceive({}); setReceiptId(receipt); await onChanged(); },
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
      <p className="text-sm text-ink-secondary">{status ? t.purchaseOrders.statuses[status] : order.status}</p>
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
      {receiptId && canBill ? (
        <div className="grid gap-3 rounded-[12px] border border-border bg-subtle/60 p-4">
          <p className="text-sm">{t.bills.received}</p>
          <button type="button" className={primaryButton} onClick={() => setBilling(true)}>
            {t.bills.add}
          </button>
        </div>
      ) : null}
      {canBill && (order.receipts ?? []).length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-medium">{t.bills.deliveries}</h2>
          <ul className="grid gap-1">
            {(order.receipts ?? []).map((receipt) => (
              <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
                <span>{formatCairoDateTime(receipt.received_at, locale)}</span>
                {receipt.bill_id ? (
                  <button type="button" className={secondaryButton} onClick={() => setOpenBill(receipt.bill_id ?? null)}>
                    {t.bills.openBill}
                    {receipt.bill_status ? ` · ${t.bills.statuses[receipt.bill_status as keyof typeof t.bills.statuses] ?? receipt.bill_status}` : ""}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => {
                      setReceiptId(receipt.id);
                      setBilling(true);
                    }}
                  >
                    {t.bills.add}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {openBill ? <BillSheet billId={openBill} onClose={() => setOpenBill(null)} /> : null}
      {billing && receiptId ? (
        <NewBillSheet
          receiptId={receiptId}
          onClose={() => setBilling(false)}
          onSaved={() => {
            setReceiptId(null);
            void onChanged();
          }}
        />
      ) : null}
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

