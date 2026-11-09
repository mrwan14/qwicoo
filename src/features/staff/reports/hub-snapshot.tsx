"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { dateFilter } from "@/components/ops/kit/date-range";
import { formatAmount } from "@/components/ops/kit/money";
import { cairoInclusiveRange } from "@/features/staff/inventory/qty";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { percentChange, previousPeriod } from "./compare";
import { analyticsPeriod } from "./period";
import { rangeLabel } from "./report-shell";
import { Trend } from "./trend";

/**
 * One number on the dark snapshot strip. The whole cell opens its report; `extra` holds the
 * change badge or the drawer status, `note` a quiet line under it.
 */
function Cell({ href, label, value, loading, extra, note }: { href: string; label: string; value: ReactNode; loading: boolean; extra?: ReactNode; note?: ReactNode }) {
  return (
    <Link
      href={href}
      className="group grid min-w-0 content-start gap-2 bg-ink px-4 py-3.5 text-on-ink sm:px-5 sm:py-4 transition-colors hover:bg-[#1f1f1f] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-ink"
    >
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-on-ink/70">
        {label}
        <ChevronRight aria-hidden className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
      </span>
      {loading ? (
        <span className="h-9 w-28 animate-pulse rounded-staff bg-on-ink/10" />
      ) : (
        <span className="truncate text-[22px] leading-8 font-semibold tabular-nums sm:text-[28px] sm:leading-9">{value}</span>
      )}
      {!loading && extra ? <span className="justify-self-start">{extra}</span> : null}
      {note ? <span className="text-xs text-on-ink/60">{note}</span> : null}
    </Link>
  );
}

const COLUMNS = ["", "xl:grid-cols-1", "xl:grid-cols-2", "xl:grid-cols-3", "xl:grid-cols-4"] as const;

/**
 * How things stand right now, above the list of reports: today's sales and orders against the
 * same day last week, the last closed drawer, and this week's food cost. Each tile opens its
 * report, and shows only when the person can open that report.
 */
export function HubSnapshot({ sales, till, stock, branchId }: { sales: boolean; till: boolean; stock: boolean; branchId: string | null }) {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const today = dateFilter("today");
  const comparison = previousPeriod(today);
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);

  const dashboard = (key: string, query: ReturnType<typeof analyticsPeriod>) =>
    ({
      queryKey: ["reports", "snapshot", key, query],
      enabled: sales,
      queryFn: async () => {
        const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query } });
        if (!result.response.ok || !result.data) throw new Error(t.loadFailed);
        return result.data.kpis;
      },
    }) as const;
  const now = useQuery(dashboard("today", analyticsPeriod(today)));
  const before = useQuery({ ...dashboard("before", { period: "custom", start_date: comparison.from, end_date: comparison.to }), enabled: sales && now.isSuccess });

  const lastClose = useQuery({
    queryKey: ["reports", "snapshot", "z", branchId],
    enabled: till && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/z-reports", { params: { query: { offset: 0, limit: 20 } } });
      if (!result.response.ok || !result.data) throw new Error(t.loadFailed);
      // Newest business day, whatever order the list comes back in.
      const items = result.data.items ?? [];
      return items.reduce<(typeof items)[number] | null>((latest, row) => (!latest || row.business_date > latest.business_date ? row : latest), null);
    },
  });

  const week = dateFilter("thisWeek");
  const food = useQuery({
    queryKey: ["reports", "snapshot", "food", branchId, week.from],
    enabled: stock && Boolean(branchId),
    queryFn: async () => {
      const range = cairoInclusiveRange(week.from, week.to);
      const result = await browserApi.GET("/api/v1/inventory/reports/usage", { params: { query: { branch_id: branchId, brand_id: null, start: range.start, end: range.end } } });
      if (!result.response.ok || !result.data) throw new Error(t.loadFailed);
      return result.data.food_cost_pct;
    },
  });

  const tiles: ReactNode[] = [];
  if (sales) {
    const kpis = now.data;
    const trend = (current?: string | number, previous?: string | number) => (kpis && before.data ? <Trend change={percentChange(current, previous)} comparison={comparison} inverse /> : null);
    tiles.push(
      <Cell key="sales" href="/app/reports/sales?range=today" label={t.snapshot.salesToday} value={kpis ? money(kpis.gmv) : "—"} loading={now.isLoading} extra={trend(kpis?.gmv, before.data?.gmv)} />,
      <Cell
        key="orders"
        href="/app/reports/sales?range=today"
        label={t.snapshot.ordersToday}
        value={kpis ? formatCount(kpis.total_orders, locale) : "—"}
        loading={now.isLoading}
        extra={trend(kpis?.total_orders, before.data?.total_orders)}
      />,
    );
  }
  if (till && branchId) {
    const report = lastClose.data;
    const variance = Number(report?.cash_reconciliation?.cash_variance ?? 0) || 0;
    // Closed without a count: there is no difference to show, and "Matches" would be wrong.
    const counted = report?.cash_reconciliation?.declared_cash != null;
    const day = report?.business_date.slice(0, 10);
    tiles.push(
      <Cell
        key="till"
        href="/app/reports/till"
        label={t.snapshot.lastClose}
        value={report && counted ? money(variance) : "—"}
        loading={lastClose.isLoading}
        extra={report && !counted ? <Badge>{t.snapshot.notCounted}</Badge> : report ? <Badge tone={variance < 0 ? "danger" : variance > 0 ? "warning" : "success"}>{variance < 0 ? t.snapshot.short : variance > 0 ? t.snapshot.over : t.snapshot.matches}</Badge> : null}
        note={day ? rangeLabel(day, day, locale) : lastClose.isSuccess ? t.snapshot.noClose : undefined}
      />,
    );
  }
  if (stock && branchId) {
    tiles.push(
      <Cell
        key="food"
        href="/app/reports/stock"
        label={t.snapshot.foodCost}
        value={food.data != null ? `${Number(food.data).toFixed(1)}%` : "—"}
        loading={food.isLoading}
        note={fill(t.snapshot.foodCostNote, { range: rangeLabel(week.from, week.to, locale) })}
      />,
    );
  }
  if (tiles.length === 0) return null;
  // Hairline gaps over a lighter fill draw the dividers between cells at any column count.
  return <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-staff bg-[#2e2e2e] shadow-card ${COLUMNS[tiles.length]}`}>{tiles}</div>;
}
