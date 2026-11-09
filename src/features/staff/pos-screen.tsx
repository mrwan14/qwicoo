"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Banknote, Check, CreditCard, Minus, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Field, Input, Select } from "@/components/ops/kit/field";
import { moveInRow } from "@/components/ops/kit/roving";
import { SidePanel } from "@/components/ops/kit/side-panel";
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
import { fetchStoreOnlineNew, storeOnlineKey } from "@/features/staff/alerts/queries";
import { printReceipt } from "@/features/staff/orders/receipt";
import { storeOnlineAvailable } from "@/features/staff/pos/store-online-api";
import { StoreOnlineTab } from "@/features/staff/pos/store-online-tab";
import {
  ALL_CATEGORIES,
  choiceRule,
  firstMissing,
  groupMax,
  groupMin,
  groupRequired,
  menuSections,
  needsChoices,
  toggleChoice,
} from "@/features/staff/pos/item-choices";
import { PaymobPosCheckout } from "@/features/staff/paymob-pos";
import type { StaffOrderReceipt } from "@/features/staff/orders/types";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
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
  /** Names of the chosen options, shown under the item on the ticket. */
  options: string[];
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
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
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
  // Cash needs an open drawer (the backend refuses it otherwise). Offline sales skip this: they
  // sync into the drawer that was open at the time.
  const queryClient = useQueryClient();
  const [openingCash, setOpeningCash] = useState("0.00");
  const drawer = useQuery({
    queryKey: ["drawer", branchId],
    enabled: Boolean(branchId) && online,
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/drawer/current");
      if (result.response.status === 404) return null;
      if (!result.response.ok) throw asApiError(result.error, result.response, t.drawerOpenFailed, locale);
      return result.data ?? null;
    },
  });
  const openDrawer = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/drawer/open", { body: { opening_balance: openingCash.trim() || "0.00" } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.drawerOpenFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.drawerOpened);
      await queryClient.invalidateQueries({ queryKey: ["drawer"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const needsDrawer = online && effectiveTender === "CASH" && drawer.isSuccess && drawer.data === null;

  const categories = useMemo(() => menu.data?.categories ?? [], [menu.data]);
  // A category that left the menu (branch switch, menu edit) falls back to All.
  const selectedCategory = categories.some((category) => category.id === categoryId) ? categoryId : ALL_CATEGORIES;
  const itemSearch = query.trim().toLowerCase();
  const sections = useMemo(
    () => menuSections(categories, selectedCategory, itemSearch, (item) => pickLocale(item.name, locale)),
    [categories, selectedCategory, itemSearch, locale],
  );
  const grouped = Boolean(itemSearch) || selectedCategory === ALL_CATEGORIES;

  function appendLine(item: MenuItem, quantity: number, optionIds: string[]) {
    const selected: Record<string, string[]> = {};
    const options: string[] = [];
    for (const group of item.modifier_groups ?? []) {
      const picked = (group.options ?? []).filter((option) => optionIds.includes(option.id));
      selected[group.id] = picked.map((option) => option.id);
      options.push(...picked.map((option) => pickLocale(option.name, locale)));
    }
    const key = [...optionIds].sort().join(",");
    setLines((current) => {
      // The same item with the same choices stacks on one line.
      const index = current.findIndex((line) => line.itemId === item.id && [...line.optionIds].sort().join(",") === key);
      if (index === -1) {
        return [
          ...current,
          { itemId: item.id, name: pickLocale(item.name, locale), quantity, optionIds, options, subtotal: previewSubtotal(item, quantity, selected) },
        ];
      }
      const next = [...current];
      const stacked = next[index].quantity + quantity;
      next[index] = { ...next[index], quantity: stacked, subtotal: previewSubtotal(item, stacked, selected) };
      return next;
    });
  }

  function addItem(item: MenuItem) {
    if (!item.is_available) {
      toast.error(t.soldOutToast);
      return;
    }
    if (needsChoices(item)) {
      setConfiguring(item);
      return;
    }
    setLines((current) => {
      const index = current.findIndex((line) => line.itemId === item.id && line.optionIds.length === 0);
      if (index === -1) {
        return [...current, { itemId: item.id, name: pickLocale(item.name, locale), quantity: 1, optionIds: [], options: [], subtotal: previewSubtotal(item, 1, {}) }];
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
  const sendDisabled = lines.length === 0 || checkout.isPending || (orderType === "DINE_IN" && !tableId.trim()) || needsDrawer;

  const pill = (active: boolean) =>
    cn(
      "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-staff border px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:text-disabled",
      active ? "border-ink bg-ink text-on-ink shadow-card" : "border-transparent bg-canvas text-ink shadow-card hover:border-ink/20",
    );

  const ticket = (
    <aside className="grid content-start gap-4 rounded-staff bg-canvas p-4 text-ink shadow-card ring-1 ring-black/5">
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
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-[15px] font-medium">
                  {line.quantity > 1 ? <span className="tabular-nums">{line.quantity} × </span> : null}
                  {line.name}
                </span>
                {line.options.length > 0 ? (
                  <span className="text-[13px] text-ink-secondary">{line.options.join(locale === "ar" ? "، " : ", ")}</span>
                ) : null}
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
        {needsDrawer ? (
          <div role="status" className="grid gap-2.5 rounded-staff border border-warning/40 bg-warning-bg px-3 py-3">
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold text-ink">{t.drawerClosedTitle}</p>
              <p className="text-[13px] text-ink">{t.drawerClosedBody}</p>
            </div>
            <div className="flex items-end gap-2">
              <Field label={t.openingCash} className="min-w-0 flex-1">
                <Input inputMode="decimal" className="h-11 tabular-nums" value={openingCash} onChange={(event) => setOpeningCash(event.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Button className="h-11" disabled={openDrawer.isPending} onClick={() => openDrawer.mutate()}>
                {openDrawer.isPending ? t.openingDrawer : t.openDrawer}
              </Button>
            </div>
          </div>
        ) : null}
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
      <div className="grid min-w-0 content-start gap-3 rounded-staff bg-well p-3 sm:p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: ALL_CATEGORIES, name: t.allItems }, ...categories.map((category) => ({ id: category.id, name: pickLocale(category.name, locale) }))].map(
            (category) => {
              const active = !itemSearch && category.id === selectedCategory;
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
                  {category.name}
                </button>
              );
            },
          )}
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
        {sections.length === 0 ? (
          <p className="text-sm text-ink-secondary">{itemSearch ? t.noSearch : selectedCategory === ALL_CATEGORIES ? t.noMenu : t.noCategory}</p>
        ) : grouped ? (
          <div className="grid gap-6">
            {sections.map(({ category, items }) => (
              <section key={category.id} aria-labelledby={`pos-category-${category.id}`} className="grid gap-2.5">
                <h2 id={`pos-category-${category.id}`} className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
                  {pickLocale(category.name, locale)}
                  <span className="text-[13px] font-normal text-ink-secondary tabular-nums">{formatCount(items.length, locale)}</span>
                </h2>
                <ItemGrid items={items} onAdd={addItem} />
              </section>
            ))}
          </div>
        ) : (
          <ItemGrid items={sections[0].items} onAdd={addItem} />
        )}
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
        <ItemChoicesPanel
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

function ItemGrid({ items, onAdd }: { items: MenuItem[]; onAdd: (item: MenuItem) => void }) {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const image = mediaUrl(item.image_url);
        const choices = (item.modifier_groups ?? []).length;
        const name = pickLocale(item.name, locale);
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.is_available}
            className="group grid content-start gap-2.5 rounded-staff bg-canvas p-2 text-start text-ink shadow-card ring-1 ring-black/5 transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-card-hover hover:ring-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none"
            onClick={() => onAdd(item)}
          >
            {/* The whole photo shows (contain, not cover) on a tinted well, so dishes are never cut off. */}
            <span className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-staff bg-well">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-200 group-enabled:group-hover:scale-[1.03] group-disabled:opacity-50 group-disabled:grayscale"
                />
              ) : (
                <span aria-hidden className="text-4xl font-semibold text-ink/25 group-disabled:text-ink/15">
                  {Array.from(name.trim())[0]?.toLocaleUpperCase(locale) ?? ""}
                </span>
              )}
              {!item.is_available ? (
                <span className="absolute inset-0 grid place-items-center bg-ink/45 text-sm font-semibold text-on-ink">{t.soldOut}</span>
              ) : null}
            </span>
            <span className="grid gap-1 px-1.5 pb-1.5">
              <span className="line-clamp-2 text-[15px] font-semibold leading-snug group-disabled:text-ink-secondary">{name}</span>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold tabular-nums group-disabled:text-ink-secondary">
                  <Money amount={String(item.base_price)} />
                </span>
                {item.is_available && choices > 0 ? <Badge>+{choices}</Badge> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The item's choices, quantity and price before it goes on the ticket. */
function ItemChoicesPanel({
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
  // Set by the first tap on Add with a choice still missing; the missing group then shows red.
  const [tried, setTried] = useState(false);
  const groupNodes = useRef(new Map<string, HTMLElement>());
  const groups = item.modifier_groups ?? [];
  const image = mediaUrl(item.image_url);
  const maxQuantity = item.max_per_order && item.max_per_order > 0 ? item.max_per_order : null;
  const missing = firstMissing(groups, selected);
  const money = (amount: string) => formatMoney(amount, undefined, locale);

  function add() {
    if (!missing) {
      onAdd(quantity, groups.flatMap((group) => selected[group.id] ?? []));
      return;
    }
    setTried(true);
    const node = groupNodes.current.get(missing.id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.querySelector<HTMLElement>('[role="radio"]:not(:disabled), [role="checkbox"]:not(:disabled)')?.focus({ preventScroll: true });
  }

  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={pickLocale(item.name, locale)}
      description={item.description ? pickLocale(item.description, locale) : undefined}
      meta={<span className="text-[15px] font-medium text-ink tabular-nums">{money(item.base_price)}</span>}
      footer={
        <div className="grid w-full gap-3">
          {missing ? (
            <p role={tried ? "alert" : undefined} className={cn("text-[13px]", tried ? "text-danger" : "text-ink-secondary")}>
              {fill(t.missingChoice, { group: pickLocale(missing.name, locale) })}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-ink">{t.quantity}</span>
              {maxQuantity ? <span className="text-xs text-ink-secondary">{fill(t.maxPerOrder, { count: maxQuantity })}</span> : null}
            </span>
            <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} />
          </div>
          <Button
            size="touch"
            className={cn("w-full justify-between px-5", missing && "opacity-60")}
            aria-disabled={missing ? true : undefined}
            onClick={add}
          >
            <span>{t.addToTicket}</span>
            <span className="tabular-nums">{money(previewSubtotal(item, quantity, selected))}</span>
          </Button>
        </div>
      }
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="-mx-5 -mt-5 h-44 w-[calc(100%+2.5rem)] max-w-none bg-subtle object-cover" />
      ) : null}
      {groups.map((group) => (
        <ChoiceGroup
          key={group.id}
          group={group}
          picked={selected[group.id] ?? []}
          flagged={tried && missing?.id === group.id}
          onToggle={(optionId) =>
            setSelected((current) => ({ ...current, [group.id]: toggleChoice(current[group.id] ?? [], group, optionId) }))
          }
          nodeRef={(node) => {
            if (node) groupNodes.current.set(group.id, node);
            else groupNodes.current.delete(group.id);
          }}
        />
      ))}
    </SidePanel>
  );
}

function ChoiceGroup({
  group,
  picked,
  flagged,
  onToggle,
  nodeRef,
}: {
  group: ModifierGroup;
  picked: string[];
  /** The cashier tried to add while this group was short. */
  flagged: boolean;
  onToggle: (optionId: string) => void;
  nodeRef: (node: HTMLElement | null) => void;
}) {
  const t = useStaffSection(posCopy);
  const { locale } = useLocale();
  const id = useId();
  const single = groupMax(group) === 1;
  const required = groupRequired(group);
  const short = picked.length < groupMin(group);
  const full = !single && picked.length >= groupMax(group);
  const options = group.options ?? [];
  const rule = choiceRule(group);
  const ruleText =
    rule.kind === "exactly"
      ? fill(t.chooseExactly, { count: rule.count })
      : rule.kind === "between"
        ? fill(t.chooseBetween, { min: rule.min, max: rule.max })
        : fill(t.chooseUpTo, { count: rule.count });
  // One tab stop per radio group: the picked option, or the first one that can be picked.
  const tabStop = options.find((option) => picked.includes(option.id))?.id ?? options.find((option) => option.is_available)?.id;

  return (
    <section ref={nodeRef} aria-labelledby={`${id}-title`} className="grid gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 id={`${id}-title`} className="text-[15px] font-semibold text-ink">
            {pickLocale(group.name, locale)}
          </h3>
          <p id={`${id}-rule`} className={cn("text-[13px]", flagged ? "text-danger" : "text-ink-secondary")}>
            {ruleText}
            {!single && picked.length > 0 ? ` · ${fill(t.chosenCount, { count: picked.length })}` : ""}
          </p>
        </div>
        {required ? (
          short ? (
            <Badge tone={flagged ? "danger" : "warning"}>{t.required}</Badge>
          ) : (
            <Badge tone="success">{t.done}</Badge>
          )
        ) : (
          <span className="pt-0.5 text-[13px] text-ink-secondary">{t.optional}</span>
        )}
      </div>
      <div
        role={single ? "radiogroup" : "group"}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-rule`}
        aria-required={single && required ? true : undefined}
        className="grid gap-2"
      >
        {options.map((option) => {
          const checked = picked.includes(option.id);
          const blocked = !option.is_available || (full && !checked);
          const delta = moneyToCents(option.price_delta);
          return (
            <button
              key={option.id}
              type="button"
              role={single ? "radio" : "checkbox"}
              aria-checked={checked}
              data-option={option.id}
              disabled={blocked}
              tabIndex={single ? (option.id === tabStop ? 0 : -1) : undefined}
              onClick={() => onToggle(option.id)}
              onKeyDown={
                single
                  ? (event) => {
                      if (moveInRow(event, "radio") === null) return;
                      const next = (document.activeElement as HTMLElement | null)?.dataset.option;
                      if (next && !picked.includes(next)) onToggle(next);
                    }
                  : undefined
              }
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-staff border px-3.5 py-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed",
                checked ? "border-ink bg-subtle" : "border-border bg-canvas",
                blocked ? "text-disabled" : !checked && "hover:border-ink-secondary",
              )}
            >
              <ChoiceMark single={single} checked={checked} blocked={blocked} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-[15px] font-medium">{pickLocale(option.name, locale)}</span>
                {!option.is_available ? <span className="text-xs text-ink-secondary">{t.soldOut}</span> : null}
              </span>
              {delta !== 0 ? (
                <span className={cn("shrink-0 text-sm tabular-nums", blocked ? "text-disabled" : "text-ink-secondary")}>
                  {delta > 0 ? "+" : "−"} {formatMoney(centsToMoney(Math.abs(delta)), undefined, locale)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChoiceMark({ single, checked, blocked }: { single: boolean; checked: boolean; blocked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center border-[1.5px]",
        single ? "rounded-full" : "rounded-[4px]",
        checked ? "border-ink bg-ink text-on-ink" : blocked ? "border-border bg-subtle" : "border-disabled bg-canvas",
      )}
    >
      {checked ? single ? <span className="size-2 rounded-full bg-on-ink" /> : <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

/** Big minus and plus for touch; the number in between can also be typed. */
function QuantityStepper({ value, max, onChange }: { value: number; max: number | null; onChange: (value: number) => void }) {
  const t = useStaffSection(posCopy);
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => Math.max(1, max ? Math.min(max, next) : next);
  const step = "inline-flex size-12 items-center justify-center text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:text-disabled disabled:hover:bg-transparent";
  return (
    <div className="flex shrink-0 items-center rounded-staff border border-border">
      <button type="button" aria-label={t.lessQuantity} disabled={value <= 1} className={cn(step, "rounded-s-staff")} onClick={() => onChange(clamp(value - 1))}>
        <Minus aria-hidden className="size-5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={t.quantity}
        className="h-12 w-12 border-x border-border bg-canvas text-center text-base font-semibold text-ink tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        value={draft ?? String(value)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(digits);
          if (Number(digits) >= 1) onChange(clamp(Number(digits)));
        }}
        onBlur={() => setDraft(null)}
      />
      <button
        type="button"
        aria-label={t.moreQuantity}
        disabled={max !== null && value >= max}
        className={cn(step, "rounded-e-staff")}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden className="size-5" />
      </button>
    </div>
  );
}
