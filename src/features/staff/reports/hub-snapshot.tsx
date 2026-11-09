"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { KpiCard } from "@/components/ops/kit/card";
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

function Tile({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-staff transition-colors hover:[&>div]:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      {children}
    </Link>
  );
}

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
    const trend = (current?: string | number, previous?: string | number) => (kpis && before.data ? <Trend change={percentChange(current, previous)} comparison={comparison} /> : null);
    tiles.push(
      <Tile key="sales" href="/app/reports/sales?range=today">
        <KpiCard label={t.snapshot.salesToday} value={kpis ? money(kpis.gmv) : "—"} loading={now.isLoading} trend={trend(kpis?.gmv, before.data?.gmv)} />
      </Tile>,
      <Tile key="orders" href="/app/reports/sales?range=today">
        <KpiCard label={t.snapshot.ordersToday} value={kpis ? formatCount(kpis.total_orders, locale) : "—"} loading={now.isLoading} trend={trend(kpis?.total_orders, before.data?.total_orders)} />
      </Tile>,
    );
  }
  if (till && branchId) {
    const report = lastClose.data;
    const variance = Number(report?.cash_reconciliation?.cash_variance ?? 0) || 0;
    // Closed without a count: there is no difference to show, and "Matches" would be wrong.
    const counted = report?.cash_reconciliation?.declared_cash != null;
    const day = report?.business_date.slice(0, 10);
    tiles.push(
      <Tile key="till" href="/app/reports/till">
        <KpiCard
          label={t.snapshot.lastClose}
          value={report && counted ? money(variance) : "—"}
          loading={lastClose.isLoading}
          trend={report && !counted ? <Badge>{t.snapshot.notCounted}</Badge> : report ? <Badge tone={variance < 0 ? "danger" : variance > 0 ? "warning" : "success"}>{variance < 0 ? t.snapshot.short : variance > 0 ? t.snapshot.over : t.snapshot.matches}</Badge> : null}
          note={day ? rangeLabel(day, day, locale) : lastClose.isSuccess ? t.snapshot.noClose : undefined}
        />
      </Tile>,
    );
  }
  if (stock && branchId) {
    tiles.push(
      <Tile key="food" href="/app/reports/stock">
        <KpiCard
          label={t.snapshot.foodCost}
          value={food.data != null ? `${Number(food.data).toFixed(1)}%` : "—"}
          loading={food.isLoading}
          note={fill(t.snapshot.foodCostNote, { range: rangeLabel(week.from, week.to, locale) })}
        />
      </Tile>,
    );
  }
  if (tiles.length === 0) return null;
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{tiles}</div>;
}
