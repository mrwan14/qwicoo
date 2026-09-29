"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { toneSurface } from "@/components/ops/status-chip";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { stationLabel } from "@/lib/status-labels";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";
import { useWorkspace } from "@/stores/workspace";

function asStation(value: string): components["schemas"]["KitchenStation"] | null {
  if (value === "HOT_KITCHEN" || value === "COLD_KITCHEN" || value === "BEVERAGE" || value === "DESSERT") return value;
  return null;
}

export function KdsScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const sound = useWorkspace((state) => state.soundEnabled);
  const setSound = useWorkspace((state) => state.setSoundEnabled);
  const seen = useRef<Set<string>>(new Set());
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const queryClient = useQueryClient();

  const tickets = useQuery({
    queryKey: ["kds-tickets", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/tickets");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tickets failed");
      return result.data;
    },
  });

  useEffect(() => {
    const ids = new Set((tickets.data ?? []).map((ticket) => ticket.sub_ticket_id));
    if (seen.current.size > 0 && sound) {
      for (const id of ids) {
        if (!seen.current.has(id)) beep();
      }
    }
    seen.current = ids;
  }, [tickets.data, sound]);

  const stations = useMemo(() => {
    const names = new Set((tickets.data ?? []).map((ticket) => ticket.station));
    return ["ALL", ...names];
  }, [tickets.data]);

  const visible = (tickets.data ?? []).filter((ticket) => stationFilter === "ALL" || ticket.station === stationFilter);

  const bumpItem = useMutation({
    mutationFn: async (orderItemId: string) => {
      const result = await browserApi.POST("/api/v1/kds/items/{order_item_id}/bump", {
        params: { path: { order_item_id: orderItemId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Bump failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["kds-tickets"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const bumpStation = useMutation({
    mutationFn: async (input: { orderId: string; station: components["schemas"]["KitchenStation"] }) => {
      const result = await browserApi.POST("/api/v1/kds/orders/{order_id}/stations/{station}/bump", {
        params: { path: { order_id: input.orderId, station: input.station } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Station bump failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["kds-tickets"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (tickets.isLoading) return <LoadingState label="Loading kitchen tickets" />;
  if (tickets.isError) return <QueryErrorState error={tickets.error} screen="The kitchen display" onRetry={() => void tickets.refetch()} />;

  const columns = stationFilter === "ALL" ? groupBy(visible, (ticket) => ticket.station) : new Map([[stationFilter, visible]]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[length:var(--text-28)] font-semibold">Kitchen</h1>
        <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setSound(!sound)}>
          Sound {sound ? "on" : "off"}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto sm:hidden">
        {[...stations].map((station) => (
          <button key={station} type="button" className="min-h-11 shrink-0 rounded-full border px-3 text-sm" onClick={() => setStationFilter(station)}>
            {station === "ALL" ? "All" : stationLabel(station)}
          </button>
        ))}
      </div>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {[...columns.entries()].map(([station, column]) => (
          <TicketColumn key={station} station={station} tickets={column} onItem={(id) => bumpItem.mutate(id)} onStation={(orderId, name) => {
            const next = asStation(name);
            if (next) bumpStation.mutate({ orderId, station: next });
          }} />
        ))}
      </div>
      <div className="grid gap-3 sm:hidden">
        <TicketColumn
          station={stationFilter}
          tickets={visible}
          onItem={(id) => bumpItem.mutate(id)}
          onStation={(orderId, name) => {
            const next = asStation(name);
            if (next) bumpStation.mutate({ orderId, station: next });
          }}
        />
      </div>
    </div>
  );
}

function TicketColumn({
  station,
  tickets,
  onItem,
  onStation,
}: {
  station: string;
  tickets: Array<{
    sub_ticket_id: string;
    order_id: string;
    station: string;
    table_number?: string | null;
    pickup_number?: number | null;
    customer_notes?: string | null;
    created_at: string;
    items?: Array<{
      order_item_id: string;
      name: string;
      quantity: number;
      is_bumped?: boolean | null;
      special_instructions?: string | null;
    }> | null;
  }>;
  onItem: (orderItemId: string) => void;
  onStation: (orderId: string, station: string) => void;
}) {
  return (
    <section className="grid content-start gap-3">
      <h2 className="text-[length:var(--text-20)] font-semibold">{station === "ALL" ? "All" : stationLabel(station)}</h2>
      {tickets.map((ticket) => {
        const age = Math.max(0, Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 60000));
        return (
          <article key={ticket.sub_ticket_id} className="grid gap-2 rounded-xl border bg-card p-3">
            <p className="text-[length:var(--text-20)] font-semibold">
              {ticket.pickup_number ?? ticket.table_number ?? "Order"} · {age} min
            </p>
            {ticket.customer_notes?.trim() ? (
              <p className={`rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>
                Order note: {ticket.customer_notes}
              </p>
            ) : null}
            <ul className="grid gap-2">
              {(ticket.items ?? []).map((item) => (
                <li key={item.order_item_id}>
                  <button type="button" className="grid min-h-14 w-full gap-0.5 rounded-lg border px-3 py-2 text-start text-base" onClick={() => onItem(item.order_item_id)}>
                    <span>
                      {item.quantity} × {item.name}
                      {item.is_bumped ? " · bumped" : ""}
                    </span>
                    {item.special_instructions?.trim() ? (
                      <span className={`rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>
                        Note: {item.special_instructions}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={() => onStation(ticket.order_id, ticket.station)}>
              Bump station
            </button>
          </article>
        );
      })}
    </section>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    map.set(name, [...(map.get(name) ?? []), item]);
  }
  return map;
}

function beep() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 880;
  oscillator.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}
