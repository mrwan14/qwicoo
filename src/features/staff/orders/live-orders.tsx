"use client";

import { useQuery } from "@tanstack/react-query";
import { CloudOff, Receipt } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { useStaffSession } from "@/components/ops/staff-session";
import { cairoDate, isOpenOrder, minutesSince } from "@/features/staff/home/numbers";
import type { OfflineOrder } from "@/features/staff/offline/queue-core";
import { isWaiting } from "@/features/staff/offline/queue-core";
import { useOfflineQueue } from "@/features/staff/offline/queue";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { orderLabel, orderTone, placeLabel, sourceLabel } from "./labels";
import { OrderPanel } from "./order-panel";
import { cairoToday, liveOrdersQuery } from "./queries";
import type { StaffOrderListItem } from "./types";

type Row = { kind: "server"; order: StaffOrderListItem } | { kind: "local"; order: OfflineOrder };

const TYPES = ["DINE_IN", "TAKEAWAY", "PICKUP", "DELIVERY", "DRIVE_THRU"] as const;
const STATUS_GROUPS = {
  toConfirm: ["PENDING_STAFF_CONFIRMATION"],
  inKitchen: ["SUBMITTED", "PREPARING"],
  ready: ["READY"],
  servedUnpaid: ["SERVED", "DELIVERED"],
} as const;
type StatusGroup = keyof typeof STATUS_GROUPS;

function typeOf(order: StaffOrderListItem): string {
  return (order.fulfillment_type ?? "").toUpperCase() || "DINE_IN";
}

/** Live tab: today's open orders, newest first, plus till orders still waiting to sync from this device. */
export function LiveOrders() {
  const t = useStaffSection(ordersCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const today = useMemo(() => cairoToday(), []);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<"all" | StatusGroup>("all");
  // `?order=` comes from Home and order alerts.
  const [selectedId, setSelectedId] = useState<string | null>(useSearchParams().get("order"));
  const [now, setNow] = useState(() => new Date());
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);

  // Waiting times tick without refetching.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const live = useQuery({ ...liveOrdersQuery(branchId, today, t.loadFailed, locale), refetchInterval: 15_000 });
  const branch = useQuery({
    queryKey: ["branch", branchId, brandId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const review = useQuery({
    queryKey: ["home", "offline-review", branchId],
    enabled: Boolean(branchId) && allowed.has("/app/offline-orders"),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/pos/offline/review", { params: { query: { state: "pending", limit: 1 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data.pending;
    },
  });
  const loaded = useOfflineQueue((state) => state.loaded);
  const queued = useOfflineQueue((state) => state.orders);
  useEffect(() => {
    if (!loaded) void useOfflineQueue.getState().load();
  }, [loaded]);

  const sla = branch.data?.sla_prep_time_minutes || 15;
  const needle = search.trim().toLocaleLowerCase();
  const open = (live.data ?? []).filter(isOpenOrder);
  const rows: Row[] = [
    ...queued
      .filter((order) => order.branchId === branchId && isWaiting(order) && order.status !== "CANCELLED")
      .map((order) => ({ kind: "local" as const, order })),
    ...open.map((order) => ({ kind: "server" as const, order })),
  ].filter((row) => {
    if (row.kind === "local") {
      if (type !== "all" && row.order.orderType !== type) return false;
      if (status !== "all" && !(STATUS_GROUPS[status] as readonly string[]).includes(row.order.status)) return false;
      return !needle || `${row.order.offlineNumber} ${row.order.tableLabel ?? ""}`.toLocaleLowerCase().includes(needle);
    }
    if (type !== "all" && typeOf(row.order) !== type) return false;
    if (status !== "all" && !(STATUS_GROUPS[status] as readonly string[]).includes(row.order.status)) return false;
    return !needle || `${orderLabel(row.order)} ${row.order.table_label ?? ""} ${placeLabel(row.order, t)}`.toLocaleLowerCase().includes(needle);
  });

  const waitingMinutes = (row: Row) => {
    const placed = row.kind === "local" ? row.order.createdAt : row.order.created_at;
    const state = row.order.status;
    return state === "SUBMITTED" || state === "PREPARING" || state === "PENDING_STAFF_CONFIRMATION" ? minutesSince(placed, now) : null;
  };

  const columns: Column<Row>[] = [
    {
      key: "order",
      header: t.order,
      strong: true,
      width: 130,
      cell: (row) => {
        if (row.kind === "local") return row.order.offlineNumber;
        const placed = new Date(row.order.created_at);
        // Still open from an earlier day: say since when, so a forgotten order stands out.
        if (cairoDate(placed) === today) return orderLabel(row.order);
        const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
          timeZone: "Africa/Cairo",
          day: "numeric",
          month: "short",
          numberingSystem: "latn",
        }).format(placed);
        return (
          <span className="grid">
            {orderLabel(row.order)}
            <span className="text-xs font-normal text-danger">{fill(t.live.since, { date: day })}</span>
          </span>
        );
      },
    },
    {
      key: "where",
      header: t.live.where,
      cell: (row) =>
        row.kind === "local"
          ? row.order.tableLabel
            ? `${t.table} ${row.order.tableLabel}`
            : row.order.orderType === "TAKEAWAY"
              ? t.live.takeaway
              : t.live.dineIn
          : placeLabel(row.order, t),
    },
    {
      key: "source",
      header: t.source,
      width: 150,
      cell: (row) => (row.kind === "local" ? sourceLabel("CASHIER_POS", t) : sourceLabel(row.order.order_source, t)),
    },
    {
      key: "waiting",
      header: t.live.waiting,
      width: 110,
      cell: (row) => {
        const minutes = waitingMinutes(row);
        return minutes === null ? "—" : fill(t.live.minutes, { minutes });
      },
    },
    {
      key: "total",
      header: t.total,
      width: 120,
      align: "end",
      cell: (row) =>
        row.kind === "local"
          ? formatAmount(row.order.totals.total_amount, "EGP", locale)
          : formatAmount(row.order.total_amount, row.order.currency || "EGP", locale),
    },
    {
      key: "status",
      header: t.status,
      width: 190,
      cell: (row) => {
        if (row.kind === "local") return <Badge tone="warning">{t.live.notSynced}</Badge>;
        const minutes = waitingMinutes(row);
        if (minutes !== null && minutes > sla && row.order.status !== "PENDING_STAFF_CONFIRMATION") {
          return <Badge tone="danger">{fill(t.live.waitingLong, { minutes })}</Badge>;
        }
        const tone = orderTone(row.order, t, locale);
        return <Badge tone={tone.tone}>{tone.label}</Badge>;
      },
    },
  ];

  const selected = (live.data ?? []).find((order) => order.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t.live.search }}
        dropdowns={[
          {
            label: t.live.type,
            value: type,
            onChange: setType,
            options: [
              { value: "all", label: t.live.allTypes },
              ...TYPES.map((value) => ({
                value,
                label: { DINE_IN: t.live.dineIn, TAKEAWAY: t.live.takeaway, PICKUP: t.live.pickup, DELIVERY: t.live.delivery, DRIVE_THRU: t.live.driveThru }[value],
              })),
            ],
          },
          {
            label: t.status,
            value: status,
            onChange: (value) => setStatus(value as "all" | StatusGroup),
            options: [
              { value: "all", label: t.live.allStatuses },
              ...(Object.keys(STATUS_GROUPS) as StatusGroup[]).map((value) => ({ value, label: t.live[value] })),
            ],
          },
        ]}
      />
      {live.isError ? (
        <p role="alert" className="text-sm text-danger">
          {live.error.message}
        </p>
      ) : null}
      {!live.isLoading && rows.length === 0 && !needle && type === "all" && status === "all" ? (
        <EmptyState icon={Receipt} title={t.live.empty} body={t.live.emptyBody} />
      ) : (
        <DataTable
          caption={t.hub.tabs.live}
          columns={columns}
          rows={rows}
          loading={live.isLoading}
          rowKey={(row) => (row.kind === "local" ? `local-${row.order.id}` : row.order.id)}
          selectedKey={selectedId}
          onRowClick={(row) => {
            if (row.kind === "server") setSelectedId(row.order.id);
          }}
          empty={t.empty}
        />
      )}
      {allowed.has("/app/offline-orders") ? (
        <Link
          href="/app/offline-orders"
          className="inline-flex w-fit items-center gap-2 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
        >
          <CloudOff aria-hidden className="size-4" />
          {review.data ? fill(t.live.offlinePending, { count: review.data }) : t.live.offline}
        </Link>
      ) : null}
      <OrderPanel orderId={selectedId} summary={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
