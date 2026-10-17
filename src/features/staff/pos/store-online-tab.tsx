"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { acknowledgeOrder } from "@/features/staff/alerts/ignore";
import { fetchStoreOnlineNew, storeOnlineKey } from "@/features/staff/alerts/queries";
import { fetchStoreOnline, markHandedOver, markPacked, type StoreOnlineOrder, type StorePackStatus } from "@/features/staff/pos/store-online-api";
import { vehicleDetails } from "@/features/staff/place-labels";
import { kdsCopy } from "@/lib/i18n/staff/kds";
import { posCopy } from "@/lib/i18n/staff/pos";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const chip = "min-h-11 shrink-0 px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function channelLabel(type: string, labels: { delivery: string; curbside: string; driveThru: string }): string {
  const value = type.trim().toUpperCase();
  if (value === "DELIVERY") return labels.delivery;
  if (value === "CURBSIDE" || value === "CURBSIDE_PICKUP") return labels.curbside;
  if (value === "DRIVE_THRU") return labels.driveThru;
  return type;
}

export function StoreOnlineTab() {
  const t = useStaffSection(posCopy);
  const kitchen = useStaffSection(kdsCopy);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StorePackStatus>("new");
  const orders = useQuery({
    queryKey: storeOnlineKey(branchId, status),
    enabled: Boolean(branchId),
    retry: false,
    queryFn: () => (status === "new" ? fetchStoreOnlineNew() : fetchStoreOnline(status)),
  });
  const move = useMutation({
    mutationFn: async (input: { orderId: string; next: "packed" | "handed_over" }) => {
      if (input.next === "packed") await markPacked(input.orderId);
      else await markHandedOver(input.orderId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store-online", branchId] });
    },
    onError: (error: Error) => toast.error(error instanceof Error ? error.message : t.storeOnlineFailed),
  });

  if (orders.isLoading) return <LoadingState label={t.loading} />;
  if (orders.isError) return <QueryErrorState error={orders.error} screen={t.storeOnlineTab} onRetry={() => void orders.refetch()} />;

  const filters: { id: StorePackStatus; label: string }[] = [
    { id: "new", label: t.filterNew },
    { id: "packed", label: t.packed },
    { id: "handed_over", label: t.handedOver },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`${chip} ${status === filter.id ? "bg-primary font-medium text-primary-foreground" : "bg-secondary"}`}
            onClick={() => setStatus(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {(orders.data ?? []).length === 0 ? <EmptyState title={t.emptyStoreOnline} body="" /> : (
        <ul className="grid gap-3">
          {orders.data?.map((order) => (
            <li key={order.order_id}>
              <StoreCard
                order={order}
                labels={{ ...t, driveThru: kitchen.driveThru }}
                pending={move.isPending && move.variables?.orderId === order.order_id}
                onOpen={() => acknowledgeOrder(order.order_id)}
                onPacked={() => {
                  acknowledgeOrder(order.order_id);
                  move.mutate({ orderId: order.order_id, next: "packed" });
                }}
                onHanded={() => move.mutate({ orderId: order.order_id, next: "handed_over" })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoreCard({
  order,
  labels,
  pending,
  onOpen,
  onPacked,
  onHanded,
}: {
  order: StoreOnlineOrder;
  labels: {
    delivery: string;
    curbside: string;
    driveThru: string;
    paid: string;
    cashDue: string;
    waitingKitchen: string;
    markPacked: string;
    markHandedOver: string;
  };
  pending: boolean;
  onOpen: () => void;
  onPacked: () => void;
  onHanded: () => void;
}) {
  const vehicle = vehicleDetails(order.vehicle_info);
  const where = order.fulfillment_type.toUpperCase() === "DELIVERY" ? order.delivery_address_label : vehicle;
  return (
    <article className="grid gap-2 border bg-card p-4" onClick={onOpen}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold tabular-nums">
          {order.display_number || order.order_id.slice(0, 8)}
          {order.pickup_number != null ? ` · #${order.pickup_number}` : ""}
        </h2>
        <p className="text-sm">{channelLabel(order.fulfillment_type, labels)}</p>
      </div>
      {order.customer_first_name ? <p className="text-sm">{order.customer_first_name}</p> : null}
      {where ? <p className="text-sm text-muted-foreground">{where}</p> : null}
      <p className="text-sm">{order.payment_status === "completed" ? labels.paid : labels.cashDue}</p>
      <p className="text-sm font-medium"><Money amount={order.total_amount} /></p>
      <ul className="grid gap-1 text-sm">
        {order.store_lines.map((line) => (
          <li key={line.order_item_id}>{line.name} × {line.quantity}</li>
        ))}
      </ul>
      {order.has_kitchen_items ? <p className="text-sm">{labels.waitingKitchen}</p> : null}
      {order.store_pack_status === "new" ? (
        <button type="button" className="min-h-11 w-fit bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending} onClick={(event) => { event.stopPropagation(); onPacked(); }}>
          {labels.markPacked}
        </button>
      ) : null}
      {order.store_pack_status === "packed" && !order.has_kitchen_items ? (
        <button type="button" className="min-h-11 w-fit border px-3 text-sm font-medium disabled:opacity-50" disabled={pending} onClick={(event) => { event.stopPropagation(); onHanded(); }}>
          {labels.markHandedOver}
        </button>
      ) : null}
    </article>
  );
}
