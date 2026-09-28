"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Money } from "@/components/ops/money";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

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
  return (
    <section role="status" aria-live="polite" className="grid gap-3 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Order sent</p>
        <StatusChip tone={confirmation.paid ? "available" : "ordered"}>{paymentLabel(confirmation)}</StatusChip>
      </div>
      {confirmation.pickup != null ? (
        <p className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">Pickup number</span>
          <span className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">#{confirmation.pickup}</span>
        </p>
      ) : null}
      <p className="flex justify-between text-sm">
        <span>{confirmation.paid ? "Collected" : "Total"}</span>
        <span className="font-semibold">
          <Money amount={confirmation.total} />
        </span>
      </p>
      <div className="flex gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={onDismiss}>
          New order
        </button>
        <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={onCancel}>
          Cancel order
        </button>
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
    queryKey: ["pos-menu", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Menu failed");
      return result.data;
    },
  });

  const categories = menu.data?.categories ?? [];
  const activeCategory = categories.find((category) => category.id === categoryId) ?? categories[0];
  const items = useMemo(() => {
    const source = activeCategory?.items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((item) => pickLocale(item.name, "en").toLowerCase().includes(needle));
  }, [activeCategory, query]);

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
    appendLine(item, 1, []);
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (!branchId || useScope.getState().branchId !== branchId) {
        throw new Error("The branch changed. Check the ticket before sending.");
      }
      const body: components["schemas"]["POSCheckoutRequest"] = {
        order_type: orderType,
        table_id: orderType === "DINE_IN" ? tableId : null,
        immediate_payment: orderType === "TAKEAWAY" ? tender : tender,
        customer_notes: null,
        items: lines.map((line) => ({
          item_id: line.itemId,
          quantity: line.quantity,
          selected_option_ids: line.optionIds,
        })),
      };
      const result = await browserApi.POST("/api/v1/pos/orders/checkout", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Checkout failed");
      return result.data;
    },
    onSuccess: (order) => {
      setConfirmation({
        id: order.id,
        pickup: order.pickup_number ?? null,
        total: order.total_amount,
        paid: order.is_paid,
        tender,
        orderType: order.order_type,
      });
      setLines([]);
      toast.success(order.pickup_number != null ? `Order sent · Pickup #${order.pickup_number}` : "Order sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!cancelId) return;
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
      setConfirmation(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (menu.isLoading) return <LoadingState label="Loading POS" />;
  if (menu.isError) return <QueryErrorState error={menu.error} screen="POS" onRetry={() => void menu.refetch()} />;

  const total = centsToMoney(lines.reduce((sum, line) => sum + moneyToCents(line.subtotal), 0));
  const sendDisabled = lines.length === 0 || checkout.isPending || (orderType === "DINE_IN" && !tableId.trim());

  const ticket = (
    <aside className="grid gap-3 rounded-xl border bg-card p-4">
      {confirmation ? (
        <OrderConfirmation
          confirmation={confirmation}
          onCancel={() => setCancelId(confirmation.id)}
          onDismiss={() => setConfirmation(null)}
        />
      ) : null}
      <h2 className="text-lg font-semibold">Ticket</h2>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : null}
      <ul className="grid gap-2">
        {lines.map((line, index) => (
          <li key={`${line.itemId}-${index}`} className="flex justify-between gap-2 text-sm">
            <span>{line.name}</span>
            <Money amount={line.subtotal} />
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
        <select className="h-12 rounded-lg border px-3" value={orderType} onChange={(event) => setOrderType(event.target.value as typeof orderType)}>
          <option value="TAKEAWAY">Takeaway</option>
          <option value="DINE_IN">Dine in</option>
        </select>
      </label>
      {orderType === "DINE_IN" ? (
        <input className="h-12 rounded-lg border px-3" placeholder="Table id" value={tableId} onChange={(event) => setTableId(event.target.value)} />
      ) : null}
      <label className="grid gap-1 text-sm">
        Tender
        <select className="h-12 rounded-lg border px-3" value={tender} onChange={(event) => setTender(event.target.value as typeof tender)}>
          <option value="CASH">Cash</option>
          <option value="POS_TERMINAL">Card terminal</option>
        </select>
      </label>
      <button type="button" className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground" disabled={sendDisabled} onClick={() => checkout.mutate()}>
        Send order
      </button>
    </aside>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(140px,20%)_minmax(0,1fr)_minmax(260px,32%)]">
      <aside className="flex gap-2 overflow-x-auto lg:flex-col">
        {categories.map((category) => {
          const active = category.id === activeCategory?.id;
          return (
            <button
              key={category.id}
              type="button"
              className={`min-h-12 shrink-0 rounded-xl px-3 text-start text-sm ${active ? "bg-primary font-medium text-primary-foreground" : "bg-card shadow-elev-1"}`}
              onClick={() => setCategoryId(category.id)}
            >
              {pickLocale(category.name, "en")}
            </button>
          );
        })}
      </aside>
      <div className="grid content-start gap-3">
        <input className="h-12 rounded-xl border bg-card px-3" placeholder="Search items" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const name = pickLocale(item.name, "en");
            const image = mediaUrl(item.image_url);
            return (
              <button key={item.id} type="button" disabled={!item.is_available} className="min-h-24 overflow-hidden rounded-2xl bg-card text-start shadow-elev-1 disabled:opacity-60" onClick={() => addItem(item)}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <span className="flex h-16 items-center justify-center bg-secondary text-xl font-semibold text-primary">{name.trim().charAt(0).toUpperCase()}</span>
                )}
                <span className="block px-3 pt-2 font-medium">{name}</span>
                <span className="block px-3 pb-3 text-sm text-muted-foreground">{item.is_available ? item.base_price : "Sold out"}</span>
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
        description="Staff cancel uses the POS cancel path and can refund the payment."
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
