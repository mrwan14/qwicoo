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

import { canApproveTransfer, canWriteStock } from "./access";
import { canReceiveTransfer, transferDestinationLabel, transferTargets } from "./transfers";
import {
  control,
  InventoryFrame,
  primaryButton,
  secondaryButton,
  useBranchCurrency,
  useBrandWarehouses,
  useWarehouses,
  warehouseLabel,
  WarehouseSelect,
} from "./chrome";
import { formatQty } from "./qty";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "SENT", "RECEIVED"] as const;
const PAGE = 50;
type Detail = components["schemas"]["TransferDetailResponse"];
type LineDraft = { ingredientId: string; unitId: string; qty: string };

export function TransfersScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId) ?? "";
  const preset = useSearchParams().get("ingredient") ?? "";
  const canWrite = canWriteStock(me?.role);
  const canApprove = canApproveTransfer(me?.role);
  const warehouses = useWarehouses();
  const labelOf = useWarehouseName();
  const [warehouseId, setWarehouseId] = useState("");
  const [direction, setDirection] = useState<"from" | "to" | "brand">(canApprove ? "brand" : "from");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | "new" | null>(preset ? "new" : null);
  const selectedWarehouse = warehouseId || warehouses.data?.[0]?.id || "";
  const transfers = useQuery({
    queryKey: ["inventory", "transfers", direction, selectedWarehouse, brandId, status, offset],
    enabled: direction === "brand" ? Boolean(brandId) : Boolean(selectedWarehouse),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/transfers", {
        params: {
          query: {
            from_warehouse_id: direction === "from" ? selectedWarehouse : null,
            to_warehouse_id: direction === "to" ? selectedWarehouse : null,
            brand_id: direction === "brand" ? brandId : null,
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
  const rows = transfers.data?.items ?? [];
  const total = transfers.data?.total ?? 0;

  return (
    <InventoryFrame page="transfers">
      <PageHeader
        title={t.transfers.title}
        detail={t.transfers.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.transfers.request}</button> : null}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {warehouses.data && direction !== "brand" ? <WarehouseSelect warehouses={warehouses.data} value={selectedWarehouse} onChange={(id) => { setWarehouseId(id); setOffset(0); }} /> : null}
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.transfers.direction}</span>
          <select className={control} value={direction} onChange={(event) => { setDirection(event.target.value as "from" | "to" | "brand"); setOffset(0); }}>
            <option value="from">{t.transfers.outgoing}</option>
            <option value="to">{t.transfers.incoming}</option>
            {canApprove ? <option value="brand">{t.transfers.wholeBrand}</option> : null}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.purchaseOrders.status}</span>
          <select className={control} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
            <option value="">{t.all}</option>
            {STATUSES.map((item) => <option key={item} value={item}>{t.transfers.statuses[item]}</option>)}
          </select>
        </label>
      </div>
      {transfers.isLoading ? <LoadingState label={t.loading} /> : null}
      {transfers.isError ? <QueryErrorState error={transfers.error} screen={t.tabs.transfers} onRetry={() => void transfers.refetch()} /> : null}
      {transfers.data && rows.length === 0 ? <EmptyState title={t.transfers.empty} body={t.transfers.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.movements.when, t.transfers.from, t.transfers.to, t.purchaseOrders.status].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = STATUSES.find((item) => item === row.status);
                return (
                  <tr key={row.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setSelected(row.id)}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatCairoDateTime(row.created_at, locale)}</td>
                    <td className="px-3 py-2">{labelOf(row.from_warehouse_id)}</td>
                    <td className="px-3 py-2">{labelOf(row.to_warehouse_id)}</td>
                    <td className="px-3 py-2">{state ? t.transfers.statuses[state] : row.status}</td>
                  </tr>
                );
              })}
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
        <TransferDrawer
          key={selected}
          transferId={selected}
          brandId={brandId}
          presetIngredient={preset}
          canWrite={canWrite}
          canApprove={canApprove}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function useTransferDestinations(enabled = true) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  return useQuery({
    queryKey: ["inventory", "transfer-destinations", brandId],
    enabled: enabled && Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/transfer-destinations", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
}

function useWarehouseName() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const local = useWarehouses();
  const brand = useBrandWarehouses();
  const destinations = useTransferDestinations(canWriteStock(me?.role));
  const catalog = new Map<string, string>();
  for (const item of local.data ?? []) catalog.set(item.id, warehouseLabel(item, t));
  for (const item of brand.data ?? []) catalog.set(item.id, warehouseLabel(item, t));
  for (const item of destinations.data ?? []) {
    if (!catalog.has(item.id)) catalog.set(item.id, transferDestinationLabel(item, locale, t.centralKitchen));
  }
  return (id: string) => catalog.get(id) ?? id.slice(0, 8);
}

function TransferDrawer({
  transferId,
  brandId,
  presetIngredient,
  canWrite,
  canApprove,
  onClose,
}: {
  transferId: string | "new";
  brandId: string;
  presetIngredient: string;
  canWrite: boolean;
  canApprove: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const currency = useBranchCurrency();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["inventory", "transfer", transferId],
    enabled: transferId !== "new",
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/transfers/{transfer_id}", {
        params: { path: { transfer_id: transferId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["inventory", "transfers"] });
    if (transferId !== "new") await queryClient.invalidateQueries({ queryKey: ["inventory", "transfer", transferId] });
  }
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader className="pe-12"><SheetTitle>{transferId === "new" ? t.transfers.request : t.transfers.title}</SheetTitle></SheetHeader>
        {transferId === "new" ? <RequestTransfer brandId={brandId} presetIngredient={presetIngredient} onClose={onClose} /> : null}
        {detail.isLoading ? <LoadingState label={t.loading} /> : null}
        {detail.isError ? <QueryErrorState error={detail.error} screen={t.tabs.transfers} onRetry={() => void detail.refetch()} /> : null}
        {detail.data ? <TransferDetail transfer={detail.data} canWrite={canWrite} canApprove={canApprove} currency={currency} onChanged={refresh} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function TransferDetail({
  transfer,
  canWrite,
  canApprove,
  currency,
  onChanged,
}: {
  transfer: Detail;
  canWrite: boolean;
  canApprove: boolean;
  currency: string;
  onChanged: () => Promise<void>;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId) ?? "";
  const scopedWarehouses = useWarehouses();
  const labelOf = useWarehouseName();
  const receiveHere = canReceiveTransfer({
    role: me?.role,
    status: transfer.status,
    toWarehouseId: transfer.to_warehouse_id,
    focusedBranchId: branchId,
    warehouses: (scopedWarehouses.data ?? []).map((item) => ({
      id: item.id,
      branchId: item.branch_id,
      central: item.kind === "CENTRAL_KITCHEN",
    })),
  });
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", transfer.brand_id, "all"],
    enabled: Boolean(transfer.brand_id),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: transfer.brand_id, active_only: false } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const ingredientName = (id: string, sku: string) => {
    const item = ingredients.data?.find((row) => row.id === id);
    return item ? pickLocale(item.name, locale) || sku : sku;
  };
  const statusLabel = (status: string) => {
    const known = STATUSES.find((item) => item === status);
    return known ? t.transfers.statuses[known] : status;
  };
  const [note, setNote] = useState("");
  const [receive, setReceive] = useState<Record<string, string>>({});
  const [closeShort, setCloseShort] = useState(false);
  const state = STATUSES.find((item) => item === transfer.status);
  const act = useMutation({
    mutationFn: async (action: "approve" | "reject" | "send" | "receive") => {
      const path = { transfer_id: transfer.id };
      const result = action === "approve"
        ? await browserApi.POST("/api/v1/inventory/transfers/{transfer_id}/approve", { params: { path } })
        : action === "reject"
          ? await browserApi.POST("/api/v1/inventory/transfers/{transfer_id}/reject", { params: { path }, body: { note: note.trim() || null } })
          : action === "send"
            ? await browserApi.POST("/api/v1/inventory/transfers/{transfer_id}/send", { params: { path } })
            : await browserApi.POST("/api/v1/inventory/transfers/{transfer_id}/receive", {
              params: { path },
              body: {
                lines: transfer.lines.flatMap((line) => {
                  const qty = receive[line.id]?.trim();
                  return qty && Number(qty) > 0 ? [{ line_id: line.id, qty }] : [];
                }),
                close_short: closeShort,
              },
            });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => { toast.success(t.saved); await onChanged(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <div className="grid gap-4 px-4 pb-6">
      <p className="text-sm">{state ? t.transfers.statuses[state] : transfer.status}</p>
      <p className="text-sm">{t.transfers.from} · {labelOf(transfer.from_warehouse_id)}</p>
      <p className="text-sm">{t.transfers.to} · {labelOf(transfer.to_warehouse_id)}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            {[t.ingredient, t.transfers.requested, t.transfers.sent, t.transfers.received, t.transfers.outstanding, t.stock.unitCost].map((label) => (
              <th key={label} className="px-2 py-2 text-start font-medium">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="px-2 py-2">{ingredientName(line.ingredient_id, line.ingredient_sku)}</td>
              <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_requested, locale)}</td>
              <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_sent, locale)}</td>
              <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_received, locale)}</td>
              <td className="px-2 py-2 tabular-nums">{formatQty(line.qty_outstanding, locale)}</td>
              <td className="px-2 py-2"><Money amount={line.unit_cost} currency={currency} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {canApprove && transfer.status === "REQUESTED" ? (
        <div className="grid gap-2">
          <button type="button" className={primaryButton} disabled={act.isPending} onClick={() => act.mutate("approve")}>{t.transfers.approve}</button>
          <label className="grid gap-1 text-sm"><span>{t.note}</span><input className={control} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button type="button" className={secondaryButton} disabled={act.isPending} onClick={() => act.mutate("reject")}>{t.transfers.reject}</button>
        </div>
      ) : null}
      {canWrite && transfer.status === "APPROVED" ? <button type="button" className={primaryButton} disabled={act.isPending} onClick={() => act.mutate("send")}>{t.transfers.send}</button> : null}
      {receiveHere ? (
        <div className="grid gap-2">
          {transfer.lines.filter((line) => Number(line.qty_outstanding) > 0).map((line) => (
            <label key={line.id} className="grid gap-1 text-sm">
              <span>{ingredientName(line.ingredient_id, line.ingredient_sku)}</span>
              <input className={`${control} h-14 text-lg`} inputMode="decimal" value={receive[line.id] ?? ""} onChange={(event) => setReceive({ ...receive, [line.id]: event.target.value })} />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={closeShort} onChange={(event) => setCloseShort(event.target.checked)} />
            {t.transfers.closeShort}
          </label>
          <p className="text-sm text-muted-foreground">{t.transfers.closeShortHint}</p>
          <button type="button" className={primaryButton} disabled={act.isPending} onClick={() => act.mutate("receive")}>{t.transfers.receive}</button>
        </div>
      ) : null}
      <section className="grid gap-2">
        <h2 className="font-medium">{t.transfers.history}</h2>
        <ol className="grid gap-2 border-s ps-3 text-sm">
          {transfer.events.map((event) => (
            <li key={event.id}>
              <span className="font-medium">{statusLabel(event.to_status)}</span>
              <span className="text-muted-foreground"> · {formatCairoDateTime(event.created_at, locale)} · {event.actor_name ?? ""}</span>
              {event.note ? <p>{event.note === "close_short" ? t.transfers.closeShortNote : event.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function RequestTransfer({ brandId, presetIngredient, onClose }: { brandId: string; presetIngredient: string; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const warehouses = useWarehouses();
  const destinations = useTransferDestinations();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const targets = transferTargets(destinations.data ?? [], fromId);
  const [lines, setLines] = useState<LineDraft[]>([{ ingredientId: presetIngredient, unitId: "", qty: "" }]);
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
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/transfers", {
        body: {
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          lines: lines.map((line) => ({ ingredient_id: line.ingredientId, unit_id: line.unitId, qty: line.qty })),
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "transfers"] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  return (
    <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <label className="grid gap-1 text-sm"><span>{t.transfers.from}</span>
        <select className={control} value={fromId} onChange={(event) => {
          const next = event.target.value;
          setFromId(next);
          if (toId === next) setToId("");
        }} required>
          <option value="">{t.transfers.from}</option>
          {(warehouses.data ?? []).map((item) => <option key={item.id} value={item.id}>{warehouseLabel(item, t)}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm"><span>{t.transfers.to}</span>
        <select className={control} value={toId} onChange={(event) => setToId(event.target.value)} required>
          <option value="">{t.transfers.to}</option>
          {targets.map((item) => <option key={item.id} value={item.id}>{transferDestinationLabel(item, locale, t.centralKitchen)}</option>)}
        </select>
      </label>
      {destinations.isError ? <QueryErrorState error={destinations.error} screen={t.tabs.transfers} onRetry={() => void destinations.refetch()} /> : null}
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 border-b py-2">
          <select className={control} value={line.ingredientId} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, ingredientId: event.target.value } : item))} required>
            <option value="">{t.ingredient}</option>
            {(ingredients.data ?? []).map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </select>
          <select className={control} value={line.unitId} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, unitId: event.target.value } : item))} required>
            <option value="">{t.unit}</option>
            {(units.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
          </select>
          <input className={control} inputMode="decimal" value={line.qty} placeholder={t.quantity} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, qty: event.target.value } : item))} required />
        </div>
      ))}
      <button type="submit" className={primaryButton} disabled={save.isPending || !fromId || !toId}>{t.transfers.request}</button>
    </form>
  );
}
