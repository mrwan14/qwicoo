"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Package, ReceiptText, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
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
 * One snapshot card. The lead number (sales today) is the single ink card so the eye lands there
 * first; the rest are white cards with an ink icon tile, like the report rows below. The whole
 * card opens its report. `extra` is the change badge or drawer status, `note` a quiet line.
 */
function Cell({
  href,
  label,
  icon: Icon,
  value,
  loading,
  extra,
  note,
  ink = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  loading: boolean;
  extra?: ReactNode;
  note?: ReactNode;
  ink?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group grid min-w-0 content-start gap-3 rounded-staff border p-4 shadow-card transition-[background-color,border-color,box-shadow] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        ink ? "border-ink bg-ink text-on-ink hover:bg-[#1f1f1f]" : "border-border bg-canvas text-ink hover:border-ink",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={cn("text-xs font-medium", ink ? "text-on-ink/70" : "text-ink-secondary")}>{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-staff", ink ? "bg-on-ink/10 text-on-ink" : "bg-ink text-on-ink")}>
          <Icon aria-hidden className="size-4" />
        </span>
      </span>
      {/* Values sit at the same height in every card so the row reads as one line of figures. */}
      <span className="grid gap-1.5">
        {loading ? (
          <span className={cn("h-9 w-28 animate-pulse rounded-staff", ink ? "bg-on-ink/10" : "bg-well")} />
        ) : (
          <span className="truncate text-[24px] leading-8 font-semibold tabular-nums sm:text-[28px] sm:leading-9">{value}</span>
        )}
        {!loading && extra ? <span className="justify-self-start">{extra}</span> : null}
        {note ? <span className={cn("text-xs", ink ? "text-on-ink/60" : "text-ink-secondary")}>{note}</span> : null}
      </span>
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
    const trend = (current?: string | number, previous?: string | number, inverse = false) =>
      kpis && before.data ? <Trend change={percentChange(current, previous)} comparison={comparison} inverse={inverse} /> : null;
    tiles.push(
      <Cell
        key="sales"
        ink
        href="/app/reports/sales?range=today"
        label={t.snapshot.salesToday}
        icon={TrendingUp}
        value={kpis ? money(kpis.gmv) : "—"}
        loading={now.isLoading}
        extra={trend(kpis?.gmv, before.data?.gmv, true)}
      />,
      <Cell
        key="orders"
        href="/app/reports/sales?range=today"
        label={t.snapshot.ordersToday}
        icon={ReceiptText}
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
        icon={Wallet}
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
        icon={Package}
        value={food.data != null ? `${Number(food.data).toFixed(1)}%` : "—"}
        loading={food.isLoading}
        note={fill(t.snapshot.foodCostNote, { range: rangeLabel(week.from, week.to, locale) })}
      />,
    );
  }
  if (tiles.length === 0) return null;
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", COLUMNS[tiles.length])}>{tiles}</div>;
}
