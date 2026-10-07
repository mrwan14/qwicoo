"use client";

import { CloudOff } from "lucide-react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { displayNumber, forStage, isWaiting, type OfflineOrder, type TransitionTarget } from "./queue-core";
import { useOfflineQueue } from "./queue";

const STEP_LABEL: Record<TransitionTarget, string> = {
  PREPARING: "Start cooking",
  READY: "Mark ready",
  DELIVERED: "Hand over",
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Orders the till on this device saved offline, for the kitchen and handover screens. Once an
 * order has reached the API it shows up in the normal tickets instead (unless we're offline).
 */
export function OfflineTickets({ stage }: { stage: "kitchen" | "handover" }) {
  const branchId = useScope((state) => state.branchId);
  const online = useNetwork((state) => state.online);
  const orders = useOfflineQueue((state) => state.orders);
  const advance = useOfflineQueue((state) => state.advance);
  const visible = branchId
    ? forStage(orders, branchId, stage).filter((order) => !online || order.actions.some((action) => action.payload.type === "create_order" && action.state === "pending"))
    : [];

  if (visible.length === 0) {
    if (online) return null;
    return (
      <p className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        {stage === "kitchen" ? "No offline orders to cook on this device." : "No offline orders ready to hand over on this device."}
      </p>
    );
  }

  const act = (order: OfflineOrder, target: TransitionTarget) =>
    void advance(order.id, target).then(() => toast.success(`${displayNumber(order)} · ${STEP_LABEL[target].toLowerCase()}`));

  return (
    <section className="grid gap-3" aria-label="Offline orders on this device">
      <div className="flex items-center gap-2">
        <CloudOff aria-hidden className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Offline orders on this device</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((order) => {
          const steps: TransitionTarget[] =
            stage === "handover" ? ["DELIVERED"] : order.status === "SUBMITTED" ? ["PREPARING", "READY"] : ["READY"];
          return (
            <article key={order.id} className="grid gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
              <div className="flex items-start justify-between gap-2">
                <div className="grid gap-0.5">
                  <span className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">{displayNumber(order)}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.orderType === "DINE_IN" ? (order.tableLabel ?? "Dine in") : "Takeaway"} · {timeLabel(order.createdAt)}
                  </span>
                </div>
                <StatusChip tone={isWaiting(order) ? "ordered" : "available"}>{isWaiting(order) ? "Not synced yet" : "Synced"}</StatusChip>
              </div>
              <ul className="grid gap-1 text-sm">
                {order.lines.map((line, index) => (
                  <li key={`${line.item_id}-${index}`}>
                    <span className="font-medium">{line.quantity} × {line.name}</span>
                    {line.modifiers.length ? <span className="block text-xs text-muted-foreground">{line.modifiers.map((mod) => mod.name).join(", ")}</span> : null}
                  </li>
                ))}
              </ul>
              {stage === "handover" ? (
                <p className="flex justify-between text-sm">
                  <span>{order.paid ? "Paid in cash" : "To pay"}</span>
                  <Money amount={order.totals.total_amount} />
                </p>
              ) : null}
              <div className="flex gap-2">
                {steps.map((target, index) => (
                  <button
                    key={target}
                    type="button"
                    className={`min-h-12 flex-1 rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${index === steps.length - 1 ? "bg-primary text-primary-foreground" : "border bg-background"}`}
                    onClick={() => act(order, target)}
                  >
                    {STEP_LABEL[target]}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Kitchen / handover screen while offline: this device's offline orders only. */
export function OfflineStage({ stage }: { stage: "kitchen" | "handover" }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{stage === "kitchen" ? "Kitchen" : "Handover"}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          You&apos;re offline, so this shows the orders taken on this device. Other tickets come back with the connection.
        </p>
      </div>
      <OfflineTickets stage={stage} />
    </div>
  );
}

/** Recent offline sales on this till, so the cashier can match OFF numbers to real ones. */
export function TillOfflineOrders() {
  const branchId = useScope((state) => state.branchId);
  const orders = useOfflineQueue((state) => state.orders);
  const recent = orders.filter((order) => order.branchId === branchId).slice(-6).reverse();
  if (recent.length === 0) return null;
  return (
    <section className="grid gap-2 border-t pt-3" aria-label="Offline orders on this till">
      <h3 className="text-sm font-semibold">Offline orders on this till</h3>
      <ul className="grid gap-1.5">
        {recent.map((order) => {
          const waiting = isWaiting(order);
          const label = order.lastError && !waiting ? "Needs attention" : order.status === "CANCELLED" ? (waiting ? "Cancelled · not synced" : "Cancelled") : waiting ? "Not synced yet" : "Synced";
          return (
            <li key={order.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="grid">
                <span className="font-medium tabular-nums">{displayNumber(order)}</span>
                {displayNumber(order) !== order.offlineNumber ? <span className="text-xs text-muted-foreground">was {order.offlineNumber}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <Money amount={order.totals.total_amount} />
                <StatusChip tone={waiting ? "ordered" : order.lastError || order.status === "CANCELLED" ? "neutral" : "available"}>{label}</StatusChip>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
