"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money } from "@/components/ops/money";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

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

const TENDER_LABEL: Partial<Record<components["schemas"]["PaymentMethod"], string>> = {
  CASH: "Cash",
  POS_TERMINAL: "Card terminal",
  CARD_TERMINAL: "Card terminal",
};

function paymentLabel(confirmation: Confirmation): string {
  if (confirmation.paid) return `Paid · ${TENDER_LABEL[confirmation.tender] ?? "Card"}`;
  return confirmation.orderType === "TAKEAWAY" ? "Payment pending" : "On the table's bill";
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
  const queued = useOfflineQueue((state) => (confirmation.offlineId ? state.orders.find((order) => order.id === confirmation.offlineId) : undefined));
  const offline = Boolean(confirmation.offlineId);
  const waiting = queued ? isWaiting(queued) : false;
  const number = queued ? displayNumber(queued) : confirmation.pickup != null ? `#${confirmation.pickup}` : null;
  const realNumber = queued ? queued.pickupNumber != null || Boolean(queued.serverId && queued.tableNumber) : true;
  return (
    <section role="status" aria-live="polite" className="grid gap-3 rounded-xl bg-muted/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{offline ? (waiting ? "Saved on this till" : "Order synced") : "Order sent"}</p>
        <StatusChip tone={confirmation.paid ? "available" : "ordered"}>{paymentLabel(confirmation)}</StatusChip>
      </div>
      {number ? (
        <p className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">{realNumber ? (confirmation.orderType === "DINE_IN" ? "Order for" : "Pickup number") : "Offline number"}</span>
          <span className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">{number}</span>
        </p>
      ) : null}
      {offline && waiting ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Give the guest this number. It syncs when the connection is back, and the real number replaces it.
        </p>
      ) : null}
      {queued?.status === "CANCELLED" ? <p className="text-sm text-muted-foreground">Cancelled on this till.</p> : null}
      <p className="flex justify-between text-sm">
        <span>{confirmation.paid ? "Collected" : "Total"}</span>
        <span className="font-semibold">
          <Money amount={confirmation.total} />
        </span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={onDismiss}>
          New order
        </button>
        {queued?.status === "CANCELLED" ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Order actions"
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" className="min-h-11" onClick={onCancel}>
                Cancel order
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
  const branchId = useScope((state) => state.branchId);
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
        .filter((item) => pickLocale(item.name, "en").toLowerCase().includes(itemSearch))
        .map((item) => ({ item, categoryName: pickLocale(category.name, "en") })),
    );
  }, [activeCategory, categories, itemSearch]);

  function appendLine(item: MenuItem, quantity: number, optionIds: string[]) {
    const selected: Record<string, string[]> = {};
    for (const group of item.modifier_groups ?? []) {
      selected[group.id] = (group.options ?? []).filter((option) => optionIds.includes(option.id)).map((option) => option.id);
    }
    setLines((current) => [
      ...current,
      {
        itemId: item.id,
        name: pickLocale(item.name, "en"),
        quantity,
        optionIds,
        subtotal: previewSubtotal(item, quantity, selected),
      },
    ]);
  }

  function addItem(item: MenuItem) {
    if (!item.is_available) {
      toast.error("Sold out. This item cannot be added.");
      return;
    }
    if (needsModifiers(item)) {
      setConfiguring(item);
      return;
    }
    setLines((current) => {
      const index = current.findIndex((line) => line.itemId === item.id && line.optionIds.length === 0);
      if (index === -1) {
        return [...current, { itemId: item.id, name: pickLocale(item.name, "en"), quantity: 1, optionIds: [], subtotal: previewSubtotal(item, 1, {}) }];
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
      if (!item) throw new Error(`${line.name} isn't on this till's saved menu. Remove it and try again.`);
      const modifiers = (item.modifier_groups ?? []).flatMap((group) =>
        (group.options ?? [])
          .filter((option) => line.optionIds.includes(option.id))
          .map((option) => ({ option_id: option.id, group_id: group.id, name: pickLocale(option.name, "en"), price_delta: String(option.price_delta) })),
      );
      const unit = moneyToCents(String(item.base_price)) + modifiers.reduce((sum, mod) => sum + moneyToCents(mod.price_delta), 0);
      return { item_id: item.id, name: line.name, quantity: line.quantity, unit_price: centsToMoney(unit), modifiers };
    });
  }

  /** Keep the sale on this device; it syncs (create + cash payment) when the API is back. */
  async function saveOffline(): Promise<Confirmation> {
    const config = offlineConfig.data;
    if (!branchId) throw new Error("Choose a branch first.");
    if (!config) throw new Error("This till hasn't saved the branch's offline settings yet. Connect once, then try again.");
    if (!config.offline_pos_enabled) throw new Error("Offline selling is switched off for this branch. Take the order when the connection is back.");
    const table = (tables.data ?? []).find((row) => row.id === tableId);
    const order = await useOfflineQueue.getState().addSale({
      branchId,
      orderType,
      tableId: orderType === "DINE_IN" ? tableId : null,
      tableLabel: table ? `Table ${table.table_number}` : null,
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
        throw new Error("The branch changed. Check the ticket before sending.");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Checkout failed");
      const order = result.data;
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
      if (order.offlineId) toast.success(`Saved on this till · ${order.offlineNumber}`);
      else toast.success(order.pickup != null ? `Order sent · Pickup #${order.pickup}` : "Order sent");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Cancel failed");
    },
    onSuccess: () => {
      toast.success("Order cancelled");
      setCancelId(null);
      if (!confirmation?.offlineId) setConfirmation(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (menu.isLoading) return <LoadingState label="Loading POS" />;
  if (menu.isError) return <QueryErrorState error={menu.error} screen="POS" onRetry={() => void menu.refetch()} />;

  const total = centsToMoney(lines.reduce((sum, line) => sum + moneyToCents(line.subtotal), 0));
  const sendDisabled = lines.length === 0 || checkout.isPending || (orderType === "DINE_IN" && !tableId.trim());

  const ticket = (
    <aside className="grid gap-3 bg-card p-4">
      {confirmation ? (
        <OrderConfirmation
          confirmation={confirmation}
          onCancel={() => setCancelId(confirmation.id)}
          onDismiss={() => setConfirmation(null)}
        />
      ) : null}
      <div>
        <h2 className="text-lg font-semibold">Ticket</h2>
        <p className="text-sm leading-6 text-muted-foreground">Tap an item to add it. Sending the ticket starts the order.</p>
      </div>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : null}
      <ul className="grid gap-2">
        {lines.map((line, index) => (
          <li key={`${line.itemId}-${index}`} className="flex items-center justify-between gap-2 text-sm">
            <span>{line.quantity > 1 ? `${line.quantity} × ` : ""}{line.name}</span>
            <span className="flex items-center gap-2">
              <Money amount={line.subtotal} />
              <button type="button" className="min-h-11 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      {lines.length > 0 ? (
        <p className="flex justify-between text-sm font-semibold">
          <span>Total</span>
          <Money amount={total} />
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        Order type
        <span className="text-sm leading-6 text-muted-foreground">{orderType === "TAKEAWAY" ? "The guest collects it, and you take payment now." : "The order is for a table. Choose the table before sending."}</span>
        <select className="h-12 rounded-xl border bg-background px-3" value={orderType} onChange={(event) => setOrderType(event.target.value as typeof orderType)}>
          <option value="TAKEAWAY">Takeaway</option>
          <option value="DINE_IN">Dine in</option>
        </select>
      </label>
      {orderType === "DINE_IN" ? (
        <label className="grid gap-1 text-sm">
          Table
          <span className="text-sm leading-6 text-muted-foreground">The order is added to this table.</span>
          <select className="h-12 rounded-xl border bg-background px-3" value={tableId} onChange={(event) => setTableId(event.target.value)}>
            <option value="">{tables.isFetching ? "Loading tables…" : "Choose a table"}</option>
            {(tables.data ?? []).map((table) => (
              <option key={table.id} value={table.id}>Table {table.table_number}</option>
            ))}
          </select>
          {tables.isError ? <span className="text-sm text-destructive">{tables.error instanceof Error ? tables.error.message : "Tables failed"}</span> : null}
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        Tender
        <span className="text-sm leading-6 text-muted-foreground">{online ? "How this order is paid." : "Cash only while you're offline. Card payments come back with the connection."}</span>
        <select className="h-12 rounded-xl border bg-background px-3" value={effectiveTender} onChange={(event) => setTender(event.target.value as typeof tender)}>
          <option value="CASH">Cash</option>
          <option value="POS_TERMINAL" disabled={!online}>
            {online ? "Card terminal" : "Card terminal (offline)"}
          </option>
        </select>
      </label>
      <button type="button" className="min-h-14 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={sendDisabled} onClick={() => checkout.mutate()}>
        {checkout.isPending ? "Sending…" : "Send order"}
      </button>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">Add an item before sending.</p> : null}
      <TillOfflineOrders />
    </aside>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(140px,20%)_minmax(0,1fr)_minmax(260px,32%)]">
      <aside className="flex gap-2 overflow-x-auto lg:flex-col">
        {categories.map((category) => {
          const active = !itemSearch && category.id === activeCategory?.id;
          const count = category.items?.length ?? 0;
          const image = mediaUrl(category.image_url);
          return (
            <button
              key={category.id}
              type="button"
              className={`flex min-h-14 shrink-0 items-center gap-2 px-3 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "bg-primary font-medium text-primary-foreground" : "bg-secondary"}`}
              onClick={() => {
                setCategoryId(category.id);
                setQuery("");
              }}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="size-10 shrink-0 rounded-lg bg-secondary object-contain" />
              ) : null}
              <span className="grid">
              <span className="text-sm">{pickLocale(category.name, "en")}</span>
              <span className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{count === 1 ? "1 item" : `${count} items`}</span>
              </span>
            </button>
          );
        })}
      </aside>
      <div className="grid content-start gap-3">
        <label className="grid gap-1 text-sm">
          Search items
          <span className="text-sm leading-6 text-muted-foreground">Finds an item in any category. Tap a result to add it.</span>
          <input className="h-12 rounded-xl border bg-card px-3" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
        </label>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{itemSearch ? "No items match that search." : "No items in this category."}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ item, categoryName }) => {
            const name = pickLocale(item.name, "en");
            const image = mediaUrl(item.image_url);
            return (
              <button key={item.id} type="button" disabled={!item.is_available} className="grid min-h-28 overflow-hidden bg-card text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60" onClick={() => addItem(item)}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-24 w-full bg-secondary object-contain" />
                ) : (
                  <span className="flex h-14 items-center justify-center bg-secondary text-lg font-semibold text-primary">{name.trim().charAt(0).toUpperCase()}</span>
                )}
                <span className="block px-3 pt-2 font-medium">{name}</span>
                {categoryName ? <span className="block px-3 text-xs text-muted-foreground">{categoryName}</span> : null}
                <span className="block px-3 pb-3 text-sm text-muted-foreground">{item.is_available ? <Money amount={String(item.base_price)} /> : "Sold out"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden lg:sticky lg:top-4 lg:block lg:self-start">{ticket}</div>
      <button type="button" className="fixed inset-x-4 bottom-20 z-30 min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground lg:hidden" onClick={() => setTicketOpen(true)}>
        Ticket ({lines.length})
      </button>
      {ticketOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background p-4 lg:hidden">
          <button type="button" className="mb-3 min-h-11 text-sm underline" onClick={() => setTicketOpen(false)}>
            Close ticket
          </button>
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
        title="Cancel this order?"
        description={
          confirmation?.offlineId === cancelId
            ? "The cancel syncs with this order, and the cash is marked as refunded. Hand the cash back to the guest."
            : "Staff cancel uses the POS cancel path and can refund the payment."
        }
        confirmLabel="Cancel order"
        destructive
        onConfirm={() => cancel.mutate()}
      />
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
          <SheetTitle>{pickLocale(item.name, "en")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-6">
          {groups.map((group) => (
            <fieldset key={group.id} className="grid gap-2">
              <legend className="text-sm font-medium">
                {pickLocale(group.name, "en")}
                {groupRequired(group) ? " · Required" : ""}
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
                  <span className="flex-1">{pickLocale(option.name, "en")}{option.is_available ? "" : " · Sold out"}</span>
                  <span className="text-muted-foreground">{option.price_delta}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <label className="grid gap-1 text-sm font-medium">
            Quantity
            <input type="number" min={1} className="h-12 rounded-lg border px-3" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <p className="text-sm font-medium">
            <Money amount={previewSubtotal(item, quantity, selected)} />
          </p>
          <button type="button" className="min-h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!ready} onClick={() => onAdd(quantity, optionIds)}>
            Add to ticket
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
