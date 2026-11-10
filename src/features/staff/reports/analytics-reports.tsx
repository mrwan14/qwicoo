"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BarChart, MeterList } from "@/components/ops/kit/bar-chart";
import { Badge } from "@/components/ops/kit/badge";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import type { DateFilter } from "@/components/ops/kit/date-range";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { percentChange, pointChange, previousPeriod } from "./compare";
import { downloadCsv } from "./csv";
import { filterQuery } from "./filter-query";
import { weightedCancelRate } from "./paging";
import { analyticsPeriod, type AnalyticsPeriodQuery } from "./period";
import { rangeLabel, ReportShell } from "./report-shell";
import { Trend } from "./trend";
import { useReportFilters } from "./use-report-filters";

type Item = components["schemas"]["ItemPerformanceItem"];
type BranchRow = components["schemas"]["BranchPerformanceRow"];

/** Period and branch, shared by the analytics reports. Brand-level roles can pick one branch or all. */
export function useAnalyticsFilters() {
  const t = useStaffSection(reportsCopy);
  const branches = useScope((state) => state.branches);
  const { range, setRange, branch: wanted, setBranch } = useReportFilters();
  // A branch carried over in the URL that this person cannot see falls back to all branches.
  const branch = branches.some((entry) => entry.id === wanted) ? wanted : "all";
  const branchFilter =
    branches.length > 1
      ? {
          label: t.branchLabel,
          value: branch,
          onChange: setBranch,
          options: [{ value: "all", label: t.allBranches }, ...branches.map((entry) => ({ value: entry.id, label: entry.name }))],
        }
      : undefined;
  const branchName = branch === "all" ? (branches.length > 1 ? t.allBranches : branches[0]?.name) : branches.find((entry) => entry.id === branch)?.name;
  return { range, setRange, branch: branch === "all" ? null : branch, branchFilter, branchName };
}

/**
 * One analytics endpoint for the chosen period and for the period it is compared with.
 * The comparison loads after the main numbers, so the page never waits on it.
 */
function usePeriodData<T>(key: string, range: DateFilter, branch: string | null, load: (query: AnalyticsPeriodQuery & { branch_id?: string }) => Promise<T>) {
  const comparison = previousPeriod(range);
  const withBranch = (query: AnalyticsPeriodQuery) => (branch ? { ...query, branch_id: branch } : query);
  const period = analyticsPeriod(range);
  const before: AnalyticsPeriodQuery = { period: "custom", start_date: comparison.from, end_date: comparison.to };
  const current = useQuery({ queryKey: ["reports", key, period, branch], queryFn: () => load(withBranch(period)) });
  const previous = useQuery({ queryKey: ["reports", key, before, branch], queryFn: () => load(withBranch(before)), enabled: current.isSuccess });
  return { current, previous: previous.data, comparison };
}

export function useSubtitle(range: DateFilter, branchName?: string | null) {
  const { locale } = useLocale();
  return [rangeLabel(range.from, range.to, locale), branchName].filter(Boolean).join(" · ");
}

function share(value: string): string {
  return `${value}%`;
}

export function SalesReport() {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const { current: data, previous, comparison } = usePeriodData("sales", filters.range, filters.branch, async (query) => {
    const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
    return result.data;
  });
  const money = (amount: string) => formatAmount(amount, undefined, locale);
  const kpis = data.data?.kpis;
  const before = previous?.kpis;
  const trend = (now: string | number | undefined, then: string | number | undefined) =>
    kpis && before ? <Trend change={percentChange(now, then)} comparison={comparison} /> : null;
  const items = data.data?.top_selling_items ?? [];
  const columns: Column<Item>[] = [
    { key: "item", header: t.sales.item, strong: true, cell: (item) => pickLocale(item.item_name, locale) },
    { key: "category", header: t.sales.category, cell: (item) => pickLocale(item.category_name, locale) || "—" },
    { key: "sold", header: t.sales.sold, align: "end", cell: (item) => formatCount(item.total_quantity_sold, locale) },
    { key: "revenue", header: t.sales.revenue, align: "end", cell: (item) => money(item.gross_revenue) },
    { key: "share", header: t.sales.share, align: "end", cell: (item) => share(item.sales_contribution_percentage) },
  ];
  return (
    <ReportShell
      group="sales"
      title={t.items.overview.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard label={t.sales.gross} value={kpis ? money(kpis.gmv) : "—"} loading={data.isLoading} trend={trend(kpis?.gmv, before?.gmv)} />
          <KpiCard label={t.sales.net} value={kpis ? money(kpis.net_revenue) : "—"} loading={data.isLoading} trend={trend(kpis?.net_revenue, before?.net_revenue)} />
          <KpiCard
            label={t.sales.orders}
            value={kpis ? formatCount(kpis.total_orders, locale) : "—"}
            loading={data.isLoading}
            trend={trend(kpis?.total_orders, before?.total_orders)}
            note={kpis ? fill(t.sales.paid, { count: kpis.paid_orders }) : undefined}
          />
          <KpiCard label={t.sales.average} value={kpis ? money(kpis.aov) : "—"} loading={data.isLoading} trend={trend(kpis?.aov, before?.aov)} />
        </>
      }
      chartTitle={t.sales.chart}
      chart={
        items.length > 0 ? (
          <MeterList
            rows={items.slice(0, 6).map((item) => ({
              key: item.item_id,
              label: pickLocale(item.item_name, locale),
              value: Number(item.gross_revenue) || 0,
              detail: money(item.gross_revenue),
            }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.overview.title} columns={columns} rows={items} loading={data.isLoading} rowKey={(item) => item.item_id} empty={t.empty} />}
      canExport={items.length > 0}
      onExport={() => {
        downloadCsv(
          `sales-${filters.range.from}-${filters.range.to}.csv`,
          [t.sales.item, t.sales.category, t.sales.sold, t.sales.revenue, t.sales.share],
          items.map((item) => [pickLocale(item.item_name, locale), pickLocale(item.category_name, locale), item.total_quantity_sold, item.gross_revenue, item.sales_contribution_percentage]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

export function BranchesReport() {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const { range, setRange } = useReportFilters();
  const router = useRouter();
  const subtitle = useSubtitle(range, t.allBranches);
  const { current: data, previous, comparison } = usePeriodData("branches", range, null, async (query) => {
    const result = await browserApi.GET("/api/v1/analytics/branches-matrix", { params: { query } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
    return result.data;
  });
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);
  const rows = [...(data.data?.branches ?? [])].sort((left, right) => Number(right.gmv) - Number(left.gmv));
  const total = rows.reduce((sum, row) => sum + (Number(row.gmv) || 0), 0);
  const cancelRate = (list: readonly BranchRow[]) => weightedCancelRate(list.map((row) => ({ paid: row.total_paid_orders, ratePct: Number(row.cancellation_rate_percentage) || 0 })));
  const cancelled = cancelRate(rows);
  const before = previous?.branches;
  const totalBefore = before?.reduce((sum, row) => sum + (Number(row.gmv) || 0), 0);
  const columns: Column<BranchRow>[] = [
    { key: "branch", header: t.branches.branch, strong: true, cell: (row) => pickLocale(row.branch_name, locale) },
    { key: "sales", header: t.sales.gross, align: "end", cell: (row) => money(row.gmv) },
    { key: "orders", header: t.branches.orders, align: "end", cell: (row) => formatCount(row.total_paid_orders, locale) },
    { key: "average", header: t.branches.average, align: "end", cell: (row) => money(row.aov) },
    { key: "cash", header: t.branches.cash, align: "end", cell: (row) => money(row.cash_revenue) },
    { key: "digital", header: t.branches.digital, align: "end", cell: (row) => money(row.digital_revenue) },
    { key: "cancelled", header: t.branches.cancelRate, align: "end", cell: (row) => share(row.cancellation_rate_percentage) },
  ];
  return (
    <ReportShell
      group="sales"
      title={t.items.branches.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: range, onChange: setRange }} />}
      kpis={
        <>
          <KpiCard label={t.branches.count} value={data.data ? formatCount(rows.length, locale) : "—"} loading={data.isLoading} />
          <KpiCard
            label={t.branches.total}
            value={data.data ? money(total) : "—"}
            loading={data.isLoading}
            trend={data.data && before ? <Trend change={percentChange(total, totalBefore)} comparison={comparison} /> : null}
          />
          <KpiCard label={t.branches.best} value={rows[0] ? pickLocale(rows[0].branch_name, locale) : "—"} loading={data.isLoading} note={rows[0] ? money(rows[0].gmv) : undefined} />
          <KpiCard
            label={t.branches.cancelled}
            value={data.data ? `${cancelled.toFixed(1)}%` : "—"}
            loading={data.isLoading}
            trend={data.data && before ? <Trend change={pointChange(cancelled, cancelRate(before))} comparison={comparison} good="down" unit="points" /> : null}
          />
        </>
      }
      chartTitle={t.branches.chart}
      chart={
        rows.length > 0 ? (
          <BarChart
            label={t.branches.chart}
            format={(value) => money(value)}
            bars={rows.map((row, index) => ({ key: row.branch_id, label: pickLocale(row.branch_name, locale), value: Number(row.gmv) || 0, highlight: index === 0 }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={
        <DataTable
          stack
          caption={t.items.branches.title}
          columns={columns}
          rows={rows}
          loading={data.isLoading}
          rowKey={(row) => row.branch_id}
          empty={t.empty}
          // Opens that branch's sales for the same period.
          onRowClick={(row) => router.push(`/app/reports/sales?${filterQuery(new URLSearchParams(), { range, branch: row.branch_id })}`)}
        />
      }
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `branches-${range.from}-${range.to}.csv`,
          [t.branches.branch, t.sales.gross, t.branches.orders, t.branches.average, t.branches.cash, t.branches.digital, t.branches.cancelRate],
          rows.map((row) => [pickLocale(row.branch_name, locale), row.gmv, row.total_paid_orders, row.aov, row.cash_revenue, row.digital_revenue, row.cancellation_rate_percentage]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

export function MenuReport() {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const { current: data, previous, comparison } = usePeriodData("menu", filters.range, filters.branch, async (query) => {
    const result = await browserApi.GET("/api/v1/analytics/menu-performance", { params: { query } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
    return result.data;
  });
  const money = (amount: string) => formatAmount(amount, undefined, locale);
  const top = data.data?.top_selling_items ?? [];
  const bottom = data.data?.bottom_selling_items ?? [];
  const categories = data.data?.category_breakdown ?? [];
  const sold = categories.reduce((sum, category) => sum + category.total_items_sold, 0);
  // Categories cover every item sold, so their totals are complete; the top and bottom lists are capped.
  const revenue = categories.reduce((sum, category) => sum + (Number(category.total_revenue) || 0), 0);
  const soldBefore = previous?.category_breakdown.reduce((sum, category) => sum + category.total_items_sold, 0);
  const revenueBefore = previous?.category_breakdown.reduce((sum, category) => sum + (Number(category.total_revenue) || 0), 0);
  const trend = (change: number | null) => (data.data && previous ? <Trend change={change} comparison={comparison} /> : null);
  const rows = [...top.map((item) => ({ item, slow: false })), ...bottom.filter((item) => !top.some((entry) => entry.item_id === item.item_id)).map((item) => ({ item, slow: true }))];
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "item", header: t.sales.item, strong: true, cell: ({ item }) => pickLocale(item.item_name, locale) },
    { key: "category", header: t.sales.category, cell: ({ item }) => pickLocale(item.category_name, locale) || "—" },
    { key: "sold", header: t.sales.sold, align: "end", cell: ({ item }) => formatCount(item.total_quantity_sold, locale) },
    { key: "revenue", header: t.sales.revenue, align: "end", cell: ({ item }) => money(item.gross_revenue) },
    { key: "tag", header: "", width: 140, cell: ({ slow }) => <Badge tone={slow ? "warning" : "success"}>{slow ? t.menu.slowList : t.menu.best}</Badge> },
  ];
  return (
    <ReportShell
      group="menu"
      title={t.items.menu.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard label={t.menu.sold} value={data.data ? formatCount(sold, locale) : "—"} loading={data.isLoading} trend={trend(percentChange(sold, soldBefore))} />
          <KpiCard label={t.menu.top} value={top[0] ? pickLocale(top[0].item_name, locale) : "—"} loading={data.isLoading} note={top[0] ? money(top[0].gross_revenue) : undefined} />
          <KpiCard label={t.menu.categories} value={data.data ? formatCount(categories.length, locale) : "—"} loading={data.isLoading} />
          <KpiCard label={t.menu.avgPrice} value={data.data && sold > 0 ? formatAmount(revenue / sold, undefined, locale) : "—"} loading={data.isLoading} trend={trend(soldBefore ? percentChange(sold > 0 ? revenue / sold : null, (revenueBefore ?? 0) / soldBefore) : null)} note={data.data ? fill(t.menu.avgPriceNote, { amount: formatAmount(revenue, undefined, locale) }) : undefined} />
        </>
      }
      chartTitle={t.menu.chart}
      chart={
        categories.length > 0 ? (
          <MeterList
            rows={categories.map((category) => ({
              key: category.category_id,
              label: pickLocale(category.category_name, locale),
              value: Number(category.total_revenue) || 0,
              detail: share(category.gmv_share_percentage),
              note: money(category.total_revenue),
            }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.menu.title} columns={columns} rows={rows} loading={data.isLoading} rowKey={({ item, slow }) => `${slow ? "slow" : "top"}-${item.item_id}`} empty={t.empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `menu-${filters.range.from}-${filters.range.to}.csv`,
          [t.sales.item, t.sales.category, t.sales.sold, t.sales.revenue, ""],
          rows.map(({ item, slow }) => [pickLocale(item.item_name, locale), pickLocale(item.category_name, locale), item.total_quantity_sold, item.gross_revenue, slow ? t.menu.slowList : t.menu.best]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
