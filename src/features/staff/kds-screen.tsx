"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, Clock, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { type Tone } from "@/components/ops/kit/badge";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { latestTimestamp, LiveCount } from "@/components/ops/live-fact";
import { formatCairoDateTime } from "@/lib/format/time";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { kdsCopy } from "@/lib/i18n/staff/kds";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { useSoundSetting } from "@/features/staff/alerts/preferences";
import { acknowledgeOrder, ignoreOwnChange } from "@/features/staff/alerts/ignore";
import { playTone, unlockAudio } from "@/lib/sound/tones";
import { stationLabel } from "@/lib/status-labels";
import { kitchenTicketKind, vehicleDetails } from "@/features/staff/place-labels";
import type { components } from "@/lib/api/schema";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { OfflineStage, OfflineTickets } from "./offline/offline-tickets";

function asStation(value: string): components["schemas"]["KitchenStation"] | null {
  if (value === "HOT_KITCHEN" || value === "COLD_KITCHEN" || value === "BEVERAGE" || value === "DESSERT") return value;
  return null;
}

function ticketTitle(
  ticket: { pickup_number?: number | null; table_number?: string | null },
  copy: typeof kdsCopy.en,
): string {
  if (ticket.pickup_number != null) return fill(copy.pickup, { number: ticket.pickup_number });
  if (ticket.table_number) return fill(copy.table, { number: ticket.table_number });
  return copy.order;
}

function kindLabel(kind: string, copy: typeof kdsCopy.en): string {
  if (kind === "Drive-thru") return copy.driveThru;
  if (kind === "Takeaway") return copy.takeaway;
  if (kind === "Dine in") return copy.dineIn;
  return kind;
}

export function KdsScreen() {
  const t = useStaffSection(kdsCopy);
  const { locale } = useLocale();
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [sound, setSound] = useSoundSetting();
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const queryClient = useQueryClient();
  const online = useNetwork((state) => state.online);

  const tickets = useQuery({
    queryKey: ["kds-tickets", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/tickets");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.ticketsFailed, locale);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.bumpFailed, locale);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.stationBumpFailed, locale);
    },
    onSuccess: (_data, input) => {
      acknowledgeOrder(input.orderId);
      ignoreOwnChange(input.orderId, "READY");
      void queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const start = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await browserApi.POST("/api/v1/orders/{order_id}/transition", {
        params: { path: { order_id: orderId } },
        body: { target_status: "PREPARING", reason: null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.board.startFailed, locale);
    },
    onSuccess: (_data, orderId) => {
      acknowledgeOrder(orderId);
      ignoreOwnChange(orderId, "PREPARING");
      void queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!online) return <OfflineStage stage="kitchen" />;
  if (tickets.isLoading) return <LoadingState label={t.loading} />;
  if (tickets.isError) return <QueryErrorState error={tickets.error} screen={t.screen} onRetry={() => void tickets.refetch()} />;

  const marking = bumpStation.isPending ? bumpStation.variables : null;
  const markingItem = bumpItem.isPending ? bumpItem.variables : null;
  const ticketCount = (tickets.data ?? []).length;
  const lastTicket = latestTimestamp((tickets.data ?? []).map((ticket) => ticket.created_at));
  const lanes: Record<Lane, typeof visible> = { new: [], preparing: [], ready: [] };
  for (const ticket of visible) lanes[laneOf(ticket)].push(ticket);

  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="sr-only">{t.title}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t.board.stations} className="flex gap-2 overflow-x-auto">
          {stations.map((station) => {
            const active = station === stationFilter;
            return (
              <button
                key={station}
                type="button"
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-12 shrink-0 items-center rounded-staff border px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  active ? "border-ink bg-ink text-on-ink" : "border-border bg-canvas text-ink hover:bg-subtle",
                )}
                onClick={() => setStationFilter(station)}
              >
                {station === "ALL" ? t.board.allStations : stationLabel(station, locale)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-ink-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-warning" />
            {t.board.over10}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-danger" />
            {t.board.over15}
          </span>
          <span className="hidden md:inline">
            <LiveCount value={ticketCount} /> {ticketCount === 1 ? t.ticketOne : t.ticketMany}
            {lastTicket ? <> · {fill(t.lastOrder, { time: formatCairoDateTime(lastTicket, locale) })}</> : null}
          </span>
          <button
            type="button"
            className={buttonClass({ variant: "secondary", size: "sm" })}
            aria-pressed={sound}
            title={t.soundHint}
            onClick={() => {
              const next = !sound;
              setSound(next);
              if (next) void unlockAudio().then(() => playTone("new"));
            }}
          >
            {sound ? t.soundOn : t.soundOff}
          </button>
        </div>
      </div>
      <OfflineTickets stage="kitchen" />
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        {LANES.map((lane) => (
          <section key={lane} className="grid content-start gap-3 rounded-staff bg-subtle p-3">
            <h2 className="flex items-center justify-between px-1 text-base font-semibold text-ink">
              {t.board.columns[lane]}
              <span className="text-ink-secondary tabular-nums">{lanes[lane].length}</span>
            </h2>
            {lanes[lane].length === 0 ? <p className="px-1 py-6 text-center text-sm text-ink-secondary">{ticketCount === 0 && lane === "new" ? t.empty : t.board.empty}</p> : null}
            {lanes[lane].map((ticket) => (
              <TicketCard
                key={ticket.sub_ticket_id}
                ticket={ticket}
                lane={lane}
                now={now}
                markingItem={markingItem ?? null}
                marking={marking?.orderId === ticket.order_id && marking.station === ticket.station}
                starting={start.isPending && start.variables === ticket.order_id}
                onItem={(id) => {
                  acknowledgeItem(id);
                  bumpItem.mutate(id);
                }}
                onStart={() => start.mutate(ticket.order_id)}
                onReady={() => {
                  const next = asStation(ticket.station);
                  if (next) bumpStation.mutate({ orderId: ticket.order_id, station: next });
                }}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

type Lane = "new" | "preparing" | "ready";
const LANES: readonly Lane[] = ["new", "preparing", "ready"];
type Ticket = components["schemas"]["KDSSubTicket"];

function laneOf(ticket: Ticket): Lane {
  if (ticket.is_fully_bumped || ticket.order_status === "READY") return "ready";
  if (ticket.order_status === "PREPARING") return "preparing";
  return "new";
}

/** Amber after 10 minutes, red after 15. */
function timerTone(minutes: number): Tone {
  if (minutes > 15) return "danger";
  if (minutes > 10) return "warning";
  return "neutral";
}

function elapsed(createdAt: string, now: number): { minutes: number; clock: string } {
  const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return { minutes, clock: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h` };
  return { minutes, clock: `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` };
}

function TicketCard({
  ticket,
  lane,
  now,
  markingItem,
  marking,
  starting,
  onItem,
  onStart,
  onReady,
}: {
  ticket: Ticket;
  lane: Lane;
  now: number;
  markingItem: string | null;
  marking: boolean;
  starting: boolean;
  onItem: (orderItemId: string) => void;
  onStart: () => void;
  onReady: () => void;
}) {
  const t = useStaffSection(kdsCopy);
  const timer = elapsed(ticket.created_at, now);
  const tone = timerTone(timer.minutes);
  const kind = kindLabel(kitchenTicketKind(ticket), t);
  const car = vehicleDetails(ticket.vehicle);
  const canMark = Boolean(asStation(ticket.station));
  const urgent = lane !== "ready" && tone !== "neutral";
  return (
    <article
      onPointerDown={() => acknowledgeOrder(ticket.order_id)}
      className={cn("grid content-start gap-3 rounded-staff border bg-canvas p-4 text-ink", urgent ? "border-ink" : "border-border")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="text-xl font-semibold">{ticketTitle(ticket, t)}</p>
          <p className="text-[13px] text-ink-secondary">{[kind, car].filter(Boolean).join(" · ")}</p>
        </div>
        <span
          role="timer"
          aria-label={fill(t.board.elapsed, { time: timer.clock })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-staff px-2 py-1 text-[13px] font-semibold tabular-nums",
            tone === "danger" ? "bg-danger-bg" : tone === "warning" ? "bg-warning-bg" : "border border-border bg-subtle",
          )}
        >
          <Clock aria-hidden className={cn("size-3.5", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink-secondary")} />
          {timer.clock}
        </span>
      </div>
      <ul className="grid gap-1.5">
        {(ticket.items ?? []).map((item) => {
          const markingLine = markingItem === item.order_item_id;
          return (
            <li key={item.order_item_id}>
              <button
                type="button"
                className="grid w-full gap-0.5 rounded-staff px-1 py-1 text-start focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
                disabled={markingLine || lane === "ready"}
                aria-label={`${item.quantity} × ${item.name}. ${item.is_bumped ? t.ready : t.tapReady}`}
                onClick={() => onItem(item.order_item_id)}
              >
                <span className={cn("text-base font-medium", item.is_bumped && "text-ink-secondary line-through")}>
                  <span className="tabular-nums">{item.quantity}</span> × {item.name}
                </span>
                {item.special_instructions?.trim() ? <span className="text-[13px] text-ink-secondary">{item.special_instructions}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {ticket.customer_notes?.trim() ? (
        <p className="rounded-staff bg-warning-bg px-3 py-2 text-[13px] text-ink">
          <span className="font-medium">{t.orderNote}</span> {ticket.customer_notes}
        </p>
      ) : null}
      {lane === "new" ? (
        <Button size="touch" className="w-full" disabled={starting} onClick={onStart}>
          <Play aria-hidden />
          {starting ? t.board.starting : t.board.start}
        </Button>
      ) : lane === "preparing" ? (
        <Button size="touch" className="w-full" disabled={!canMark || marking} onClick={onReady}>
          <Check aria-hidden />
          {marking ? t.marking : t.ready}
        </Button>
      ) : (
        <p className="text-center text-[13px] text-ink-secondary">{t.board.waitingRunner}</p>
      )}
    </article>
  );
}
