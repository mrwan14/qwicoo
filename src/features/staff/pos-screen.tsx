"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Banknote, CreditCard, MoreHorizontal, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Field, Input, Select } from "@/components/ops/kit/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money } from "@/components/ops/money";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchStoreOnlineNew, storeOnlineKey } from "@/features/staff/alerts/queries";
import { printReceipt } from "@/features/staff/orders/receipt";
import { storeOnlineAvailable } from "@/features/staff/pos/store-online-api";
import { StoreOnlineTab } from "@/features/staff/pos/store-online-tab";
import { PaymobPosCheckout } from "@/features/staff/paymob-pos";
import type { StaffOrderReceipt } from "@/features/staff/orders/types";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { posCopy } from "@/lib/i18n/staff/pos";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel } from "@/lib/status-labels";
import { mediaUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

const AUTO_PRINT_KEY = "qwicoo-pos-auto-print";

function readAutoPrint(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTO_PRINT_KEY) === "1";
}

async function fetchAndPrintReceipt(orderId: string, locale: "en" | "ar", failed: string): Promise<void> {
  const result = await browserApi.GET("/api/v1/orders/{order_id}/receipt", {
    params: { path: { order_id: orderId } },
  });
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed, locale);
  const receipt = result.data as StaffOrderReceipt;
  const labels = ordersCopy[locale];
  await printReceipt(receipt, locale, {
    receipt: labels.receipt,
    date: labels.date,
    table: labels.table,
    cashier: labels.cashier,
    subtotal: labels.subtotal,
    discount: labels.discount,
    serviceFee: labels.serviceFee,
    tax: labels.tax,
    total: labels.total,
    paid: labels.paid,
    unpaid: labels.unpaid,
    thanks: labels.thanks,
  });
}

import { fetchMenu, fetchTables, offlineQueryKeys, useOfflineConfig } from "./offline/offline-data";
import { displayNumber, isWaiting, type OfflineLine } from "./offline/queue-core";
import { useOfflineQueue } from "./offline/queue";
import { TillOfflineOrders } from "./offline/offline-tickets";

type MenuItem = components["schemas"]["MenuItemResponse"];
type ModifierGroup = components["schemas"]["ModifierGroupResponse"];

type Line = {
  itemId: string;
  name: string;
  quantity: number;
  optionIds: string[];
  subtotal: string;
};

type Confirmation = {
  id: string;
  /** Set when the order was saved on this till while offline (queue id). */
  offlineId?: string;
  offlineNumber?: string;
  pickup: number | null;
  total: string;
  paid: boolean;
  tender: components["schemas"]["PaymentMethod"];
  orderType: components["schemas"]["OrderType"];
};

function paymentLabel(confirmation: Confirmation, copy: typeof posCopy.en): string {
  if (confirmation.paid) return fill(copy.paidWith, { method: paymentMethodLabel(confirmation.tender) });
  return confirmation.orderType === "TAKEAWAY" ? copy.paymentPending : copy.onTableBill;
}

function OrderConfirmation({
  confirmation,
  onCancel,
  onDismiss,
}: {
  confirmation: Confirmation;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  const [autoPrint, setAutoPrint] = useState(readAutoPrint);
  const [printing, setPrinting] = useState(false);
  const queued = useOfflineQueue((state) => (confirmation.offlineId ? state.orders.find((order) => order.id === confirmation.offlineId) : undefined));
  const offline = Boolean(confirmation.offlineId);
  const waiting = queued ? isWaiting(queued) : false;
  const number = queued ? displayNumber(queued) : confirmation.pickup != null ? `#${confirmation.pickup}` : null;
  const realNumber = queued ? queued.pickupNumber != null || Boolean(queued.serverId && queued.tableNumber) : true;
  const canPrint = !offline;

  async function handlePrint() {
    if (!canPrint) return;
    setPrinting(true);
    try {
      await fetchAndPrintReceipt(confirmation.id, locale, t.receiptFailed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.receiptFailed);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <section role="status" aria-live="polite" className="grid gap-3 rounded-staff bg-muted/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{offline ? (waiting ? t.savedOnTill : t.orderSynced) : t.orderSent}</p>
        <StatusChip tone={confirmation.paid ? "available" : "ordered"}>{paymentLabel(confirmation, t)}</StatusChip>
      </div>
      {number ? (
        <p className="grid gap-0.5">
          <span className="text-xs text-ink-secondary">{realNumber ? (confirmation.orderType === "DINE_IN" ? t.orderFor : t.pickupNumber) : t.offlineNumber}</span>
          <span className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">{number}</span>
        </p>
      ) : null}
      {offline && waiting ? (
        <p className="text-sm leading-6 text-ink-secondary">{t.giveGuestNumber}</p>
      ) : null}
      {queued?.status === "CANCELLED" ? <p className="text-sm text-ink-secondary">{t.cancelledOnTill}</p> : null}
      <p className="flex justify-between text-sm">
        <span>{confirmation.paid ? t.collected : t.total}</span>
        <span className="font-semibold">
          <Money amount={confirmation.total} />
        </span>
      </p>
      {canPrint ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(event) => {
              const on = event.target.checked;
              setAutoPrint(on);
              window.localStorage.setItem(AUTO_PRINT_KEY, on ? "1" : "0");
            }}
          />
          <span>
            {t.autoPrint}
            <span className="ms-1 text-ink-secondary">{t.autoPrintHint}</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {canPrint ? (
          <button type="button" className="min-h-11 flex-1 rounded-staff border text-sm font-medium disabled:opacity-50" disabled={printing} onClick={() => void handlePrint()}>
            {printing ? t.printingReceipt : t.printReceipt}
          </button>
        ) : null}
        <button type="button" className="min-h-11 flex-1 rounded-staff bg-primary text-sm font-medium text-primary-foreground" onClick={onDismiss}>
          {t.newOrder}
        </button>
        {queued?.status === "CANCELLED" ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t.orderActions}
              className="inline-flex size-11 items-center justify-center rounded-staff text-ink-secondary hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" className="min-h-11" onClick={onCancel}>
                {t.cancelOrder}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </section>
  );
}

function moneyToCents(value: string): number {
  const negative = value.trim().startsWith("-");
  const [whole = "0", frac = ""] = value.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function centsToMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function groupRequired(group: ModifierGroup): boolean {
  return group.is_required || group.min_choices > 0;
}

function needsModifiers(item: MenuItem): boolean {
  return (item.modifier_groups ?? []).some(groupRequired);
}

function groupMin(group: ModifierGroup): number {
  if (group.is_required) return Math.max(1, group.min_choices);
  return group.min_choices;
}

function previewSubtotal(item: MenuItem, quantity: number, selected: Record<string, string[]>): string {
  const groups = item.modifier_groups ?? [];
  let cents = moneyToCents(item.base_price);
  for (const group of groups) {
    const picked = new Set(selected[group.id] ?? []);
    for (const option of group.options ?? []) {
      if (picked.has(option.id)) cents += moneyToCents(option.price_delta);
    }
  }
  return centsToMoney(cents * quantity);
}

export function PosScreen() {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchId = useScope((state) => state.branchId);
  const storeRole = me?.role === "CASHIER" || me?.role === "BRANCH_ADMIN" || me?.role === "BRAND_ADMIN" || me?.role === "SUPER_ADMIN";
  const probe = useQuery({
    queryKey: storeOnlineKey(branchId, "probe"),
    enabled: Boolean(branchId) && storeRole,
    retry: false,
    queryFn: () => storeOnlineAvailable(locale),
  });
  const [storeShown, setStoreShown] = useState(false);
  useEffect(() => {
    if (probe.data === true) setStoreShown(true);
    if (probe.data === false) setStoreShown(false);
  }, [probe.data]);
  const newStoreOrders = useQuery({
    queryKey: storeOnlineKey(branchId, "new"),
    enabled: storeShown && Boolean(branchId),
    retry: false,
    queryFn: () => fetchStoreOnlineNew(locale),
  });
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<components["schemas"]["OrderType"]>("TAKEAWAY");
  const [tableId, setTableId] = useState("");
  const [tender, setTender] = useState<components["schemas"]["PaymentMethod"]>("CASH");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);
  const online = useNetwork((state) => state.online);
  const tables = useQuery({
    queryKey: offlineQueryKeys.tables(branchId),
    enabled: Boolean(branchId) && orderType === "DINE_IN",
    // Run even when the browser reports offline: the fetcher answers from the till's saved copy.
    networkMode: "always",
    queryFn: () => fetchTables(branchId ?? ""),
  });
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    useScope.getState().setSwitchGuard({
      pendingItems: () => linesRef.current.reduce((sum, line) => sum + line.quantity, 0),
      close: () => {
        setLines([]);
        setTicketOpen(false);
        setConfiguring(null);
      },
    });
    return () => useScope.getState().setSwitchGuard(null);
  }, []);

  const menu = useQuery({
    queryKey: offlineQueryKeys.menu(branchId),
    enabled: Boolean(branchId),
    networkMode: "always",
    queryFn: () => fetchMenu(branchId ?? ""),
  });

  const offlineConfig = useOfflineConfig(branchId);

  // Card and online payments need the network; offline the till takes cash only.
  const effectiveTender: components["schemas"]["PaymentMethod"] = online ? tender : "CASH";

  const categories = menu.data?.categories ?? [];
  const activeCategory = categories.find((category) => category.id === categoryId) ?? categories[0];
  const itemSearch = query.trim().toLowerCase();
  const items = useMemo(() => {
    if (!itemSearch) {
      return (activeCategory?.items ?? []).map((item) => ({ item, categoryName: "" }));
    }
    return categories.flatMap((category) =>
      (category.items ?? [])
        .filter((item) => pickLocale(item.name, locale).toLowerCase().includes(itemSearch))
        .map((item) => ({ item, categoryName: pickLocale(category.name, locale) })),
    );
  }, [activeCategory, categories, itemSearch, locale]);

  function appendLine(item: MenuItem, quantity: number, optionIds: string[]) {
    const selected: Record<string, string[]> = {};
    for (const group of item.modifier_groups ?? []) {
      selected[group.id] = (group.options ?? []).filter((option) => optionIds.includes(option.id)).map((option) => option.id);
    }
    setLines((current) => [
      ...current,
      {
        itemId: item.id,
        name: pickLocale(item.name, locale),
        quantity,
        optionIds,
        subtotal: previewSubtotal(item, quantity, selected),
      },
    ]);
  }

  function addItem(item: MenuItem) {
    if (!item.is_available) {
      toast.error(t.soldOutToast);
      return;
    }
    if (needsModifiers(item)) {
      setConfiguring(item);
      return;
    }
    setLines((current) => {
      const index = current.findIndex((line) => line.itemId === item.id && line.optionIds.length === 0);
      if (index === -1) {
        return [...current, { itemId: item.id, name: pickLocale(item.name, locale), quantity: 1, optionIds: [], subtotal: previewSubtotal(item, 1, {}) }];
      }
      const next = [...current];
      const quantity = next[index].quantity + 1;
      next[index] = { ...next[index], quantity, subtotal: previewSubtotal(item, quantity, {}) };
      return next;
    });
  }

  function offlineLines(): OfflineLine[] {
    const catalogue = new Map((menu.data?.categories ?? []).flatMap((category) => (category.items ?? []).map((item) => [item.id, item] as const)));
    return lines.map((line) => {
      const item = catalogue.get(line.itemId);
      if (!item) throw new Error(fill(t.notOnMenu, { name: line.name }));
      const modifiers = (item.modifier_groups ?? []).flatMap((group) =>
        (group.options ?? [])
          .filter((option) => line.optionIds.includes(option.id))
          .map((option) => ({ option_id: option.id, group_id: group.id, name: pickLocale(option.name, locale), price_delta: String(option.price_delta) })),
      );
      const unit = moneyToCents(String(item.base_price)) + modifiers.reduce((sum, mod) => sum + moneyToCents(mod.price_delta), 0);
      return { item_id: item.id, name: line.name, quantity: line.quantity, unit_price: centsToMoney(unit), modifiers };
    });
  }

  /** Keep the sale on this device; it syncs (create + cash payment) when the API is back. */
  async function saveOffline(): Promise<Confirmation> {
    const config = offlineConfig.data;
    if (!branchId) throw new Error(t.chooseBranch);
    if (!config) throw new Error(t.noOfflineSettings);
    if (!config.offline_pos_enabled) throw new Error(t.offlineOff);
    const table = (tables.data ?? []).find((row) => row.id === tableId);
    const order = await useOfflineQueue.getState().addSale({
      branchId,
      orderType,
      tableId: orderType === "DINE_IN" ? tableId : null,
      tableLabel: table ? fill(t.tableNumber, { number: table.table_number }) : null,
      lines: offlineLines(),
      rules: config,
      payCash: true,
    });
    return {
      id: order.id,
      offlineId: order.id,
      offlineNumber: order.offlineNumber,
      pickup: null,
      total: order.totals.total_amount,
      paid: order.paid,
      tender: "CASH",
      orderType,
    };
  }

  const checkout = useMutation({
    // Never pause while offline: offline sales go to the till's queue instead.
    networkMode: "always",
    mutationFn: async (): Promise<Confirmation> => {
      if (!branchId || useScope.getState().branchId !== branchId) {
        throw new Error(t.branchChanged);
      }
      if (!useNetwork.getState().online) return saveOffline();
      const body: components["schemas"]["POSCheckoutRequest"] = {
        order_type: orderType,
        table_id: orderType === "DINE_IN" ? tableId : null,
        immediate_payment: effectiveTender,
        customer_notes: null,
        items: lines.map((line) => ({
          item_id: line.itemId,
          quantity: line.quantity,
          selected_option_ids: line.optionIds,
        })),
      };
      let result;
      try {
        result = await browserApi.POST("/api/v1/pos/orders/checkout", { body });
      } catch (error) {
        // Our own server couldn't be reached, so the order never left this device.
        if (error instanceof TypeError && effectiveTender === "CASH") return saveOffline();
        throw error;
      }
      // 502 is our proxy saying the API refused the connection: nothing was created.
      if (result.response.status === 502 && effectiveTender === "CASH") return saveOffline();
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.checkoutFailed, locale);
      const order = result.data;
      // Fire-and-forget so checkout UI is not blocked while the print dialog is open.
      if (order.is_paid && readAutoPrint()) {
        void fetchAndPrintReceipt(order.id, locale, t.receiptFailed).catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : t.receiptFailed);
        });
      }
      return {
        id: order.id,
        pickup: order.pickup_number ?? null,
        total: order.total_amount,
        paid: order.is_paid,
        tender: effectiveTender,
        orderType: order.order_type,
      };
    },
    onSuccess: (order) => {
      setConfirmation(order);
      setLines([]);
      if (order.offlineId) toast.success(fill(t.savedTillToast, { number: order.offlineNumber ?? "" }));
      else toast.success(order.pickup != null ? fill(t.sentPickup, { number: order.pickup }) : t.orderSent);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      if (!cancelId) return;
      if (confirmation?.offlineId === cancelId) {
        await useOfflineQueue.getState().cancel(cancelId, "Cashier cancel");
        return;
      }
      const body: components["schemas"]["POSCancelOrderRequest"] = {
        reason: "Cashier cancel",
        refund_payment: true,
      };
      const result = await browserApi.POST("/api/v1/pos/orders/{order_id}/cancel", {
        params: { path: { order_id: cancelId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.cancelFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.orderCancelled);
      setCancelId(null);
      if (!confirmation?.offlineId) setConfirmation(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const viewingStore = storeShown && searchParams.get("tab") === "store-online";
  if (!viewingStore && menu.isLoading) return <LoadingState label={t.loading} />;
  if (!viewingStore && menu.isError) return <QueryErrorState error={menu.error} screen={t.screen} onRetry={() => void menu.refetch()} />;

  const total = centsToMoney(lines.reduce((sum, line) => sum + moneyToCents(line.subtotal), 0));
  const sendDisabled = lines.length === 0 || checkout.isPending || (orderType === "DINE_IN" && !tableId.trim());

  const pill = (active: boolean) =>
    cn(
      "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-staff border px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:text-disabled",
      active ? "border-ink bg-ink text-on-ink" : "border-border bg-canvas text-ink hover:bg-subtle",
    );

  const ticket = (
    <aside className="grid content-start gap-4 rounded-staff border border-border bg-canvas p-4 text-ink">
      {confirmation ? (
        <OrderConfirmation
          confirmation={confirmation}
          onCancel={() => setCancelId(confirmation.id)}
          onDismiss={() => setConfirmation(null)}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-xl font-semibold">{t.ticket}</h2>
          <p className="text-[13px] text-ink-secondary">{t.ticketHint}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label={t.orderType} className="grid grid-cols-2 gap-1 rounded-staff border border-border p-1">
        {(["DINE_IN", "TAKEAWAY"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={orderType === value}
            className={cn(
              "min-h-12 rounded-staff text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-focus",
              orderType === value ? "bg-ink text-on-ink" : "text-ink hover:bg-subtle",
            )}
            onClick={() => setOrderType(value)}
          >
            {value === "DINE_IN" ? t.dineIn : t.takeaway}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-[13px] text-ink-secondary">{orderType === "TAKEAWAY" ? t.takeawayHint : t.dineInHint}</p>
      {orderType === "DINE_IN" ? (
        <Field label={t.table} hint={tables.isError ? undefined : t.tableHint} error={tables.isError ? (tables.error instanceof Error ? tables.error.message : t.tablesFailed) : undefined}>
          <Select className="[&_select]:h-12 [&_select]:text-base" value={tableId} onChange={(event) => setTableId(event.target.value)}>
            <option value="">{tables.isFetching ? t.loadingTables : t.chooseTable}</option>
            {(tables.data ?? []).map((table) => (
              <option key={table.id} value={table.id}>
                {fill(t.tableNumber, { number: table.table_number })}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {lines.length === 0 ? (
        <p className="rounded-staff bg-subtle px-3 py-6 text-center text-sm text-ink-secondary">{t.noItems}</p>
      ) : (
        <ul className="-my-1">
          {lines.map((line, index) => (
            <li key={`${line.itemId}-${index}`} className="flex min-h-14 items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <span className="min-w-0 flex-1 text-[15px] font-medium">
                {line.quantity > 1 ? <span className="tabular-nums">{line.quantity} × </span> : null}
                {line.name}
              </span>
              <span className="shrink-0 text-[15px] tabular-nums">
                <Money amount={line.subtotal} />
              </span>
              <button
                type="button"
                aria-label={`${t.remove} ${line.name}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-staff text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {orderType === "DINE_IN" && tableId ? <PaymobPosCheckout tableId={tableId} online={online} /> : null}
      <div className="grid gap-2 border-t border-border pt-3">
        <p className="flex items-baseline justify-between text-lg font-semibold">
          <span>{t.total}</span>
          <span className="tabular-nums">
            <Money amount={total} />
          </span>
        </p>
        <div role="radiogroup" aria-label={t.tender} className="grid grid-cols-2 gap-2">
          {(["CASH", "POS_TERMINAL"] as const).map((value) => {
            const disabled = value === "POS_TERMINAL" && !online;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={effectiveTender === value}
                disabled={disabled}
                title={disabled ? fill(t.methodOffline, { method: paymentMethodLabel(value) }) : undefined}
                className={pill(effectiveTender === value)}
                onClick={() => setTender(value)}
              >
                {value === "CASH" ? <Banknote aria-hidden className="size-4" /> : <CreditCard aria-hidden className="size-4" />}
                <span className="mx-auto">{paymentMethodLabel(value)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-ink-secondary">{online ? t.tenderOnline : t.tenderOffline}</p>
      </div>
      <Button size="touch" className="min-h-[60px] w-full text-[17px]" disabled={sendDisabled} onClick={() => checkout.mutate()}>
        {checkout.isPending ? t.sending : lines.length > 0 ? `${t.sendOrder} · ${formatMoney(total, undefined, locale)}` : t.sendOrder}
      </Button>
      {lines.length === 0 ? <p className="-mt-2 text-[13px] text-ink-secondary">{t.addBeforeSend}</p> : null}
      <TillOfflineOrders />
    </aside>
  );

  const sale = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <div className="grid min-w-0 content-start gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => {
            const active = !itemSearch && category.id === activeCategory?.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                className={pill(active)}
                onClick={() => {
                  setCategoryId(category.id);
                  setQuery("");
                }}
              >
                {pickLocale(category.name, locale)}
              </button>
            );
          })}
        </div>
        <Input
          icon={Search}
          type="search"
          className="[&_input]:h-12 [&_input]:text-base"
          aria-label={t.searchItems}
          placeholder={t.searchItems}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        {items.length === 0 ? <p className="text-sm text-ink-secondary">{itemSearch ? t.noSearch : t.noCategory}</p> : null}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {items.map(({ item, categoryName }) => {
            const name = pickLocale(item.name, locale);
            const image = mediaUrl(item.image_url);
            const choices = (item.modifier_groups ?? []).length;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.is_available}
                className="grid min-h-[112px] content-between gap-2 overflow-hidden rounded-staff border border-border bg-canvas p-3.5 text-start text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-subtle disabled:text-ink-secondary"
                onClick={() => addItem(item)}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="-mx-3.5 -mt-3.5 h-20 w-[calc(100%+1.75rem)] max-w-none bg-subtle object-cover" />
                ) : null}
                <span className="grid gap-0.5">
                  <span className="text-base font-medium leading-snug">{name}</span>
                  {categoryName ? <span className="text-xs text-ink-secondary">{categoryName}</span> : null}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-secondary tabular-nums">
                    <Money amount={String(item.base_price)} />
                  </span>
                  {!item.is_available ? <Badge tone="danger">{t.soldOut}</Badge> : choices > 0 ? <Badge>+{choices}</Badge> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden lg:sticky lg:top-[76px] lg:block lg:self-start">{ticket}</div>
      <Button size="touch" className="fixed inset-x-4 bottom-4 z-30 lg:hidden" onClick={() => setTicketOpen(true)}>
        {fill(t.ticketCount, { count: lines.length })}
      </Button>
      {ticketOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-canvas p-4 lg:hidden">
          <Button variant="ghost" className="mb-3" onClick={() => setTicketOpen(false)}>
            {t.closeTicket}
          </Button>
          {ticket}
        </div>
      ) : null}
      {configuring ? (
        <ModifierSheet
          item={configuring}
          onClose={() => setConfiguring(null)}
          onAdd={(quantity, optionIds) => {
            appendLine(configuring, quantity, optionIds);
            setConfiguring(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title={t.cancelTitle}
        description={confirmation?.offlineId === cancelId ? t.cancelOffline : t.cancelOnline}
        confirmLabel={t.cancelOrder}
        destructive
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );

  function openTab(next: "sale" | "store-online") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "store-online") params.set("tab", "store-online");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `/app/pos?${query}` : "/app/pos");
  }

  return (
    <div className="grid gap-4">
      {storeShown ? (
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" aria-pressed={!viewingStore} className={pill(!viewingStore)} onClick={() => openTab("sale")}>
            {t.newSale}
          </button>
          <button type="button" aria-pressed={viewingStore} className={pill(viewingStore)} onClick={() => openTab("store-online")}>
            {t.storeOnlineTab}
            {newStoreOrders.data ? <span className="tabular-nums">{newStoreOrders.data.length}</span> : null}
          </button>
        </div>
      ) : null}
      {viewingStore ? <StoreOnlineTab /> : sale}
    </div>
  );
}

function ModifierSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (quantity: number, optionIds: string[]) => void;
}) {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const groups = item.modifier_groups ?? [];

  function toggle(group: ModifierGroup, optionId: string) {
    setSelected((current) => {
      const existing = current[group.id] ?? [];
      const max = group.max_choices ?? 1;
      const has = existing.includes(optionId);
      const next = has ? existing.filter((id) => id !== optionId) : max <= 1 ? [optionId] : [...existing, optionId].slice(-max);
      return { ...current, [group.id]: next };
    });
  }

  const ready = groups.every((group) => (selected[group.id] ?? []).length >= groupMin(group));
  const optionIds = groups.flatMap((group) => selected[group.id] ?? []);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{pickLocale(item.name, locale)}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-6">
          {groups.map((group) => (
            <fieldset key={group.id} className="grid gap-2">
              <legend className="text-sm font-medium">
                {pickLocale(group.name, locale)}
                {groupRequired(group) ? ` · ${t.required}` : ""}
              </legend>
              {(group.options ?? []).map((option) => (
                <label key={option.id} className="flex min-h-12 items-center gap-3 text-sm">
                  <input
                    type={group.max_choices === 1 ? "radio" : "checkbox"}
                    name={group.id}
                    checked={(selected[group.id] ?? []).includes(option.id)}
                    disabled={!option.is_available}
                    onChange={() => toggle(group, option.id)}
                  />
                  <span className="flex-1">{pickLocale(option.name, locale)}{option.is_available ? "" : ` · ${t.soldOut}`}</span>
                  <span className="text-ink-secondary">{option.price_delta}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <label className="grid gap-1 text-sm font-medium">
            {t.quantity}
            <input type="number" min={1} className="h-12 rounded-staff border px-3" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <p className="text-sm font-medium">
            <Money amount={previewSubtotal(item, quantity, selected)} />
          </p>
          <button type="button" className="min-h-12 rounded-staff bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!ready} onClick={() => onAdd(quantity, optionIds)}>
            {t.addToTicket}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
