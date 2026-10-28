"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Monitor, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import type { Tone } from "@/components/ops/kit/badge";
import { BarChart } from "@/components/ops/kit/bar-chart";
import { buttonClass } from "@/components/ops/kit/button";
import { Card, KpiCard } from "@/components/ops/kit/card";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { formatAmount } from "@/components/ops/kit/money";
import { PageHeader } from "@/components/ops/kit/page-header";
import { Avatar } from "@/components/ops/shell/user-menu";
import { useStaffSession } from "@/components/ops/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffOrderListItem, StaffOrderListResponse } from "@/features/staff/orders/types";
import { useWarehouses } from "@/features/staff/inventory/chrome";
import { canOpenInventoryPage } from "@/features/staff/inventory/access";
import { formatQty } from "@/features/staff/inventory/qty";
import { fetchFloorLive, floorLiveQueryKey } from "@/hooks/use-floor-live";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { commonCopy } from "@/lib/i18n/staff/common";
import { homeCopy } from "@/lib/i18n/staff/home";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { paymentMethodLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import { AskBox } from "./ask-box";
import {
  cairoDate,
  cairoHour,
  cairoLongDate,
  cairoTime,
  cairoWeekday,
  greetingKey,
  isOpenOrder,
  isWaitingForKitchen,
  minutesSince,
  percentChange,
  salesByHour,
  signedPercent,
} from "./numbers";

const LIVE = 30_000;
const PAGE = 50;
const MAX_PAGES = 10;

/** Every order placed today at this branch, newest first (up to 500). */
async function fetchTodayOrders(date: string, failed: string) {
  const items: StaffOrderListItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await browserApi.GET("/api/v1/orders", {
      params: { query: { date_from: date, date_to: date, limit: PAGE, cursor } },
    });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed);
    const data = result.data as StaffOrderListResponse;
    items.push(...data.items);
    cursor = data.next_cursor ?? null;
    if (!cursor) break;
  }
  return { items, partial: Boolean(cursor) };
}

type Attention = { key: string; tone: Tone; text: string; detail?: string; action?: { href: string; label: string } };

function AttentionRow({ row }: { row: Attention }) {
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[row.tone]}`} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{row.text}</span>
        {row.detail ? <span className="truncate text-xs text-ink-secondary">{row.detail}</span> : null}
      </div>
      {row.action ? (
        <Link href={row.action.href} className={buttonClass({ variant: "secondary", size: "sm" })}>
          {row.action.label}
        </Link>
      ) : null}
    </li>
  );
}

const DOT: Record<Tone, string> = {
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  success: "bg-success",
  neutral: "bg-ink-secondary",
};

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 rounded-staff" />
      ))}
    </div>
  );
}

export function BranchHome() {
  const t = useStaffSection(homeCopy);
  const common = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === state.branchId)?.name ?? "");
  const now = useMemo(() => new Date(), []);
  const today = cairoDate(now);
  const lastWeek = cairoDate(now, 7);
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);
  const canStock = Boolean(me && canOpenInventoryPage(me.role, "stock"));

  const branch = useQuery({
    queryKey: ["branch", branchId, brandId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const currency = branch.data?.currency || "EGP";
  const money = (amount: string | number) => formatAmount(amount, currency, locale);

  const dashboard = useQuery({
    queryKey: ["home", "dashboard", branchId, today],
    enabled: Boolean(branchId),
    refetchInterval: LIVE,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query: { period: "today", branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const sameDayLastWeek = useQuery({
    queryKey: ["home", "dashboard", branchId, lastWeek],
    enabled: Boolean(branchId),
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/analytics/dashboard", {
        params: { query: { period: "custom", start_date: lastWeek, end_date: lastWeek, branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const orders = useQuery({
    queryKey: ["home", "orders", branchId, today],
    enabled: Boolean(branchId) && allowed.has("/app/orders"),
    refetchInterval: LIVE,
    queryFn: () => fetchTodayOrders(today, t.loadFailed),
  });
  const floor = useQuery({
    queryKey: floorLiveQueryKey(branchId),
    enabled: Boolean(branchId) && allowed.has("/app/floor"),
    refetchInterval: LIVE,
    queryFn: () => fetchFloorLive(branchId),
  });
  const requests = useQuery({
    queryKey: ["service-queue", branchId],
    enabled: Boolean(branchId) && allowed.has("/app/floor/requests"),
    refetchInterval: LIVE,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/service-requests/active");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const payments = useQuery({
    queryKey: ["payments-pending", branchId],
    enabled: Boolean(branchId) && allowed.has("/app/orders/payments"),
    refetchInterval: LIVE,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/payments/branch/pending");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const offline = useQuery({
    queryKey: ["home", "offline-review", branchId],
    enabled: Boolean(branchId) && allowed.has("/app/offline-orders"),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/pos/offline/review", { params: { query: { state: "pending", limit: 1 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data.pending;
    },
  });
  const warehouses = useWarehouses();
  // Branch stores come first; central kitchens after.
  const warehouseId = warehouses.data?.[0]?.id ?? "";
  const stock = useQuery({
    queryKey: ["inventory", "stock", warehouseId],
    enabled: canStock && Boolean(warehouseId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", { params: { path: { warehouse_id: warehouseId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data.items;
    },
  });
  const staff = useQuery({
    queryKey: ["home", "on-shift", branchId, today],
    enabled: Boolean(branchId),
    refetchInterval: 120_000,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-logs", {
        params: { path: { branch_id: branchId ?? "" }, query: { filter_type: "daily" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return (result.data.records ?? []).filter((record) => record.check_in && !record.check_out);
    },
  });

  const kpis = dashboard.data?.kpis;
  const change = percentChange(kpis?.gmv, sameDayLastWeek.data?.kpis.gmv);
  const todayOrders = orders.data?.items ?? [];
  const open = todayOrders.filter(isOpenOrder);
  const inKitchen = open.filter(isWaitingForKitchen);
  const hours = salesByHour(todayOrders, cairoHour(now.toISOString()) ?? 0);
  const nowHour = cairoHour(now.toISOString());
  const sla = branch.data?.sla_prep_time_minutes || 15;

  const attention: Attention[] = [];
  for (const order of inKitchen
    .map((order) => ({ order, minutes: minutesSince(order.created_at, now) }))
    .filter((row) => row.minutes > sla)
    .sort((left, right) => right.minutes - left.minutes)
    .slice(0, 3)) {
    const label = order.order.display_number?.trim() || (order.order.pickup_number != null ? `#${order.order.pickup_number}` : `#${order.order.id.slice(0, 6)}`);
    attention.push({
      key: `order-${order.order.id}`,
      tone: "danger",
      text: fill(t.branch.attention.orderWaiting, { order: label, minutes: order.minutes }),
      detail: order.order.table_label ? `${common.table} ${order.order.table_label}` : undefined,
      action: { href: `/app/orders?order=${order.order.id}`, label: t.branch.attention.openOrder },
    });
  }
  for (const request of (requests.data ?? []).slice(0, 3)) {
    const table = request.table_number ? `${common.table} ${request.table_number}` : common.table;
    const minutes = minutesSince(request.created_at, now);
    const copy =
      request.request_type === "WAITER_CALL"
        ? t.branch.attention.waiterCall
        : request.request_type === "BILL_REQUEST"
          ? t.branch.attention.billRequest
          : t.branch.attention.otherRequest;
    attention.push({
      key: `request-${request.id}`,
      tone: "info",
      text: fill(copy, { table }),
      detail: minutes < 1 ? t.branch.attention.justNow : fill(t.branch.attention.minutesAgo, { minutes }),
      action: { href: "/app/orders?view=tables", label: t.branch.attention.openCalls },
    });
  }
  for (const payment of (payments.data ?? []).slice(0, 2)) {
    attention.push({
      key: `payment-${payment.id}`,
      tone: "warning",
      text: fill(t.branch.attention.paymentWaiting, { method: paymentMethodLabel(payment.payment_method, locale) }),
      detail: money(payment.amount),
      action: { href: "/app/orders/payments", label: t.branch.attention.confirm },
    });
  }
  if (offline.data) {
    attention.push({
      key: "offline",
      tone: "warning",
      text: fill(t.branch.attention.offlineReview, { count: offline.data }),
      action: { href: "/app/offline-orders", label: t.branch.attention.review },
    });
  }
  for (const row of (stock.data ?? []).filter((item) => item.status !== "ok").slice(0, 3)) {
    const name = pickLocale(row.name, locale);
    attention.push({
      key: `stock-${row.ingredient_id}`,
      tone: row.status === "low" ? "warning" : "danger",
      text: fill(row.status === "low" ? t.branch.attention.lowStock : t.branch.attention.outOfStock, { item: name }),
      detail: fill(t.branch.attention.left, { qty: formatQty(row.on_hand, locale), unit: row.base_unit_code }),
      action: canOpenInventoryPage(me?.role, "purchaseOrders")
        ? { href: "/app/inventory/purchase-orders", label: t.branch.attention.buyMore }
        : undefined,
    });
  }
  const attentionLoading = orders.isLoading || requests.isLoading || payments.isLoading;

  if (!me) return null;
  const firstName = me.full_name.split(/\s+/)[0] ?? me.full_name;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <PageHeader
        title={fill(t.greeting[greetingKey(nowHour ?? 9)], { name: firstName })}
        subtitle={[cairoLongDate(now, locale), branchName].filter(Boolean).join(" · ")}
        actions={
          <>
            {allowed.has("/app/kds") ? (
              <Link href="/app/kds" className={buttonClass({ variant: "secondary" })}>
                <Monitor aria-hidden />
                {t.openKitchen}
              </Link>
            ) : null}
            {allowed.has("/app/pos") ? (
              <Link href="/app/pos" className={buttonClass()}>
                <Receipt aria-hidden />
                {t.openPos}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t.branch.kpis.sales}
          value={kpis ? money(kpis.gmv) : "—"}
          loading={dashboard.isLoading}
          note={change !== null ? fill(t.branch.kpis.vsLastWeek, { change: signedPercent(change), day: cairoWeekday(now, locale) }) : undefined}
        />
        <KpiCard
          label={t.branch.kpis.openOrders}
          value={orders.data ? open.length : "—"}
          loading={orders.isLoading}
          note={orders.data ? fill(t.branch.kpis.waitingKitchen, { count: inKitchen.length }) : undefined}
        />
        <KpiCard
          label={t.branch.kpis.tables}
          value={floor.data ? fill(t.branch.kpis.tablesOf, { used: floor.data.occupied_tables, total: floor.data.total_tables }) : "—"}
          loading={floor.isLoading}
          note={floor.data ? fill(t.branch.kpis.awaitingFood, { count: floor.data.tables_awaiting_food }) : undefined}
        />
        <KpiCard
          label={t.branch.kpis.average}
          value={kpis ? money(kpis.aov) : "—"}
          loading={dashboard.isLoading}
          note={kpis ? fill(t.branch.kpis.paidOrders, { count: kpis.paid_orders }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 gap-4">
          <Card title={t.branch.attention.title}>
            {attentionLoading ? (
              <RowsSkeleton />
            ) : attention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t.branch.attention.allClear} body={t.branch.attention.allClearBody} className="border-0 p-4" />
            ) : (
              <ul className="-my-1">
                {attention.slice(0, 6).map((row) => (
                  <AttentionRow key={row.key} row={row} />
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t.branch.hours.title}
            action={allowed.has("/app/reports") ? <CardLink href="/app/reports">{t.branch.hours.link}</CardLink> : undefined}
          >
            {orders.isLoading ? (
              <Skeleton className="h-[200px] rounded-staff" />
            ) : hours.every((bucket) => bucket.total === 0) ? (
              <p className="py-10 text-center text-sm text-ink-secondary">{t.branch.hours.empty}</p>
            ) : (
              <>
                <BarChart
                  label={t.branch.hours.chart}
                  format={(value) => money(value)}
                  bars={hours.map((bucket) => ({
                    key: String(bucket.hour),
                    label: String(bucket.hour).padStart(2, "0"),
                    value: bucket.total,
                    highlight: bucket.hour === nowHour,
                  }))}
                />
                <p className="text-xs text-ink-secondary">
                  {orders.data?.partial ? fill(t.branch.hours.partial, { count: todayOrders.length }) : t.branch.hours.note}
                </p>
              </>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card
            title={t.branch.staff.title}
            action={allowed.has("/app/attendance") ? <CardLink href="/app/attendance">{t.branch.staff.seeAll}</CardLink> : undefined}
          >
            {staff.isLoading ? (
              <RowsSkeleton rows={2} />
            ) : (staff.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-ink-secondary">{t.branch.staff.empty}</p>
            ) : (
              <ul className="grid gap-3">
                {(staff.data ?? []).slice(0, 6).map((person) => (
                  <li key={person.id} className="flex items-center gap-3">
                    <Avatar name={person.employee_name} />
                    <div className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-ink">{person.employee_name}</span>
                      <span className="truncate text-xs text-ink-secondary">
                        {fill(t.branch.staff.since, { time: cairoTime(person.check_in ?? "", locale) })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AskBox />
        </div>
      </div>
    </div>
  );
}
