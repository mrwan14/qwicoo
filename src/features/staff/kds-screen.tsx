"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip, toneSurface } from "@/components/ops/status-chip";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { useSoundSetting } from "@/features/staff/alerts/preferences";
import { acknowledgeOrder, ignoreOwnChange } from "@/features/staff/alerts/ignore";
import { playTone, unlockAudio } from "@/lib/sound/tones";
import { stationLabel } from "@/lib/status-labels";
import type { components } from "@/lib/api/schema";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { OfflineStage, OfflineTickets } from "./offline/offline-tickets";

function asStation(value: string): components["schemas"]["KitchenStation"] | null {
  if (value === "HOT_KITCHEN" || value === "COLD_KITCHEN" || value === "BEVERAGE" || value === "DESSERT") return value;
  return null;
}

function waitingLabel(createdAt: string): { text: string; tone: "neutral" | "ordered" | "soldout" } {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  const tone = minutes >= 60 ? "soldout" : minutes >= 15 ? "ordered" : "neutral";
  if (minutes < 60) return { text: minutes === 1 ? "Waiting 1 min" : `Waiting ${minutes} min`, tone };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return { text: rest ? `Waiting ${hours} h ${rest} min` : `Waiting ${hours} h`, tone };
  const days = Math.floor(hours / 24);
  return { text: days === 1 ? "Waiting 1 day" : `Waiting ${days} days`, tone };
}

function ticketTitle(ticket: { pickup_number?: number | null; table_number?: string | null }): string {
  if (ticket.pickup_number != null) return `Pickup ${ticket.pickup_number}`;
  if (ticket.table_number) return `Table ${ticket.table_number}`;
  return "Order";
}

function orderTypeLabel(orderType: string | null | undefined): string {
  if (orderType === "TAKEAWAY") return "Takeaway";
  if (orderType === "DINE_IN") return "Dine in";
  return "";
}

export function KdsScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [sound, setSound] = useSoundSetting();
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const queryClient = useQueryClient();
  const online = useNetwork((state) => state.online);

  const tickets = useQuery({
    queryKey: ["kds-tickets", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/tickets");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tickets failed");
      return result.data;
    },
  });

  // New-ticket tones come from the shared staff alert watcher, so Kitchen never beeps twice.

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

  const acknowledgeItem = (orderItemId: string) => {
    const ticket = (tickets.data ?? []).find((row) => (row.items ?? []).some((item) => item.order_item_id === orderItemId));
    if (ticket) acknowledgeOrder(ticket.order_id);
  };

  const bumpStation = useMutation({
    mutationFn: async (input: { orderId: string; station: components["schemas"]["KitchenStation"] }) => {
      const result = await browserApi.POST("/api/v1/kds/orders/{order_id}/stations/{station}/bump", {
        params: { path: { order_id: input.orderId, station: input.station } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Station bump failed");
    },
    onSuccess: (_data, input) => {
      acknowledgeOrder(input.orderId);
      ignoreOwnChange(input.orderId, "READY");
      void queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!online) return <OfflineStage stage="kitchen" />;
  if (tickets.isLoading) return <LoadingState label="Loading kitchen tickets" />;
  if (tickets.isError) return <QueryErrorState error={tickets.error} screen="The kitchen display" onRetry={() => void tickets.refetch()} />;

  const columns = stationFilter === "ALL" ? groupBy(visible, (ticket) => ticket.station) : new Map([[stationFilter, visible]]);

  const marking = bumpStation.isPending ? bumpStation.variables : null;
  const markingItem = bumpItem.isPending ? bumpItem.variables : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-[length:var(--text-28)] font-semibold">Kitchen</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Tickets waiting to be cooked. Tap a dish when it is ready. Mark ready sends every dish on that ticket on.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-xl border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            if (next) void unlockAudio().then(() => playTone("new"));
          }}
        >
          Sound {sound ? "on" : "off"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">Turn sound on to hear a tone when a new ticket arrives.</p>
      <OfflineTickets stage="kitchen" />
      <div className="flex gap-2 overflow-x-auto">
        {[...stations].map((station) => {
          const active = station === stationFilter;
          const count = station === "ALL" ? (tickets.data ?? []).length : (tickets.data ?? []).filter((ticket) => ticket.station === station).length;
          return (
            <button
              key={station}
              type="button"
              className={`min-h-11 shrink-0 rounded-full px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "bg-primary font-medium text-primary-foreground" : "border bg-card"}`}
              onClick={() => setStationFilter(station)}
            >
              {station === "ALL" ? "All" : stationLabel(station)} · {count}
            </button>
          );
        })}
      </div>
      {(tickets.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets waiting. New orders appear here.</p>
      ) : (
        <div className="grid gap-6">
          {[...columns.entries()].map(([station, column]) => (
            <TicketColumn
              key={station}
              station={station}
              tickets={column}
              markingItem={markingItem ?? null}
              marking={marking ?? null}
              onItem={(id) => {
                acknowledgeItem(id);
                bumpItem.mutate(id);
              }}
              onStation={(orderId, name) => {
                const next = asStation(name);
                if (next) bumpStation.mutate({ orderId, station: next });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketColumn({
  station,
  tickets,
  markingItem,
  marking,
  onItem,
  onStation,
}: {
  station: string;
  tickets: Array<{
    sub_ticket_id: string;
    order_id: string;
    station: string;
    order_type?: string | null;
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
  markingItem: string | null;
  marking: { orderId: string; station: string } | null;
  onItem: (orderItemId: string) => void;
  onStation: (orderId: string, station: string) => void;
}) {
  const heading = station === "ALL" ? "All" : stationLabel(station);
  return (
    <section className="grid content-start gap-3">
      <div>
        <h2 className="text-[length:var(--text-20)] font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground">{tickets.length === 1 ? "1 ticket waiting" : `${tickets.length} tickets waiting`}</p>
      </div>
      {tickets.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => {
          const waiting = waitingLabel(ticket.created_at);
          const kind = orderTypeLabel(ticket.order_type);
          const markingThis = marking?.orderId === ticket.order_id && marking.station === ticket.station;
          const canMark = Boolean(asStation(ticket.station));
          return (
            <article key={ticket.sub_ticket_id} onPointerDown={() => acknowledgeOrder(ticket.order_id)} className="grid content-start gap-3 rounded-2xl border bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[length:var(--text-20)] font-semibold">{ticketTitle(ticket)}</p>
                  {kind ? <p className="text-sm text-muted-foreground">{kind}</p> : null}
                </div>
                <StatusChip tone={waiting.tone}>{waiting.text}</StatusChip>
              </div>
              {ticket.customer_notes?.trim() ? (
                <p className={`rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>
                  Order note: {ticket.customer_notes}
                </p>
              ) : null}
              <ul className="grid gap-2">
                {(ticket.items ?? []).map((item) => {
                  const markingLine = markingItem === item.order_item_id;
                  return (
                    <li key={item.order_item_id}>
                      <button
                        type="button"
                        className="grid min-h-14 w-full gap-0.5 rounded-xl border px-3 py-2 text-start text-base focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                        disabled={markingLine}
                        onClick={() => onItem(item.order_item_id)}
                      >
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {markingLine ? "Marking…" : item.is_bumped ? "Ready" : "Tap when this dish is ready"}
                        </span>
                        {item.special_instructions?.trim() ? (
                          <span className={`rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>
                            Note: {item.special_instructions}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm leading-6 text-muted-foreground">Marks every dish on this ticket as prepared.</p>
              <button
                type="button"
                className="min-h-14 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                disabled={!canMark || markingThis}
                onClick={() => onStation(ticket.order_id, ticket.station)}
              >
                {markingThis ? "Marking…" : "Mark ready"}
              </button>
            </article>
          );
        })}
      </div>
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

