"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Building2, Coins, LayoutGrid, ReceiptText, TrendingUp, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { dateFilter, type DateFilter } from "@/components/ops/kit/date-range";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { PageHeader } from "@/components/ops/kit/page-header";
import { Panel, PanelLink } from "@/components/ops/kit/panel";
import { StatCard } from "@/components/ops/kit/stat-card";
import { useStaffSession } from "@/components/ops/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { percentChange, previousPeriod } from "@/features/staff/reports/compare";
import { filterQuery } from "@/features/staff/reports/filter-query";
import { analyticsPeriod, type AnalyticsPeriodQuery } from "@/features/staff/reports/period";
import { Trend } from "@/features/staff/reports/trend";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { homeCopy } from "@/lib/i18n/staff/home";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { AskBox } from "./ask-box";
import { cairoHour, greetingKey } from "./numbers";

type BranchRow = components["schemas"]["BranchPerformanceRow"];

/** A thin share bar under a list row: ink on a pale track, so the longest bar reads first. */
function ShareBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-well">
      <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${width}%` }} />
    </span>
  );
}

/** Brand admin: the brand's sales across every branch, the branch matrix and what sells. */
export function BrandHome() {
  const t = useStaffSection(homeCopy);
  const { locale } = useLocale();
  const router = useRouter();
  const me = useStaffSession();
  const brandName = useScope((state) => state.brandName) ?? "";
  const branches = useScope((state) => state.branches);
  const branchId = useScope((state) => state.branchId);
  const [range, setRange] = useState<DateFilter>(() => dateFilter("today"));
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);
  const canReport = allowed.has("/app/reports/sales");
  const now = useMemo(() => new Date(), []);
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);
  const comparison = previousPeriod(range);

  const load = async (query: AnalyticsPeriodQuery) => {
    const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
    return result.data;
  };
  const period = analyticsPeriod(range);
  const before: AnalyticsPeriodQuery = { period: "custom", start_date: comparison.from, end_date: comparison.to };
  const data = useQuery({ queryKey: ["home", "brand-dashboard", period], queryFn: () => load(period) });
  // The comparison loads after the main numbers, so the page never waits on it.
  const earlier = useQuery({ queryKey: ["home", "brand-dashboard", before], queryFn: () => load(before), enabled: data.isSuccess });

  const kpis = data.data?.kpis;
  const prior = earlier.data?.kpis;
  const ranking = data.data?.branch_rankings ?? [];
  const top = (data.data?.top_selling_items ?? []).slice(0, 6);
  const categories = (data.data?.category_breakdown ?? []).slice(0, 6);
  const topMax = Math.max(0, ...top.map((item) => item.total_quantity_sold));
  const shareMax = Math.max(0, ...categories.map((category) => Number(category.gmv_share_percentage) || 0));
  const reportHref = (path: string, extra: { branch?: string } = {}) => `${path}?${filterQuery(new URLSearchParams(), { range, ...extra })}`;
  const trend = (current?: string | number, previous?: string | number, options: { good?: "up" | "down"; inverse?: boolean } = {}) =>
    kpis && prior ? <Trend change={percentChange(current, previous)} comparison={comparison} good={options.good} inverse={options.inverse} /> : null;

  const columns: Column<BranchRow>[] = [
    { key: "branch", header: t.brand.branches.branch, cell: (row) => pickLocale(row.branch_name, locale), strong: true },
    { key: "sales", header: t.brand.branches.sales, cell: (row) => money(row.gmv), align: "end" },
    { key: "orders", header: t.brand.branches.orders, cell: (row) => formatCount(row.total_paid_orders, locale), align: "end" },
    { key: "average", header: t.brand.branches.average, cell: (row) => money(row.aov), align: "end" },
    { key: "cash", header: t.brand.branches.cash, cell: (row) => money(row.cash_revenue), align: "end" },
    { key: "digital", header: t.brand.branches.digital, cell: (row) => money(row.digital_revenue), align: "end" },
    { key: "cancelled", header: t.brand.branches.cancelled, cell: (row) => `${Number(row.cancellation_rate_percentage).toFixed(1)}%`, align: "end" },
  ];

  if (!me) return null;
  const firstName = me.full_name.split(/\s+/)[0] ?? me.full_name;
  const salesHref = canReport ? reportHref("/app/reports/sales") : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-4">
      <PageHeader
        title={fill(t.greeting[greetingKey(cairoHour(now.toISOString()) ?? 9)], { name: firstName })}
        subtitle={fill(branches.length === 1 ? t.brand.subtitleOne : t.brand.subtitle, { brand: brandName, count: branches.length })}
        // On phones the period buttons scroll sideways on their own instead of widening the page.
        actions={
          <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:max-w-none sm:overflow-visible sm:px-0">
            <FilterBar date={{ value: range, onChange: setRange }} className="flex-nowrap" />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          ink
          href={salesHref}
          icon={TrendingUp}
          label={t.brand.kpis.gross}
          value={kpis ? money(kpis.gmv) : "—"}
          loading={data.isLoading}
          extra={trend(kpis?.gmv, prior?.gmv, { inverse: true })}
          note={kpis ? fill(t.brand.kpis.refunds, { amount: money(kpis.total_refunds) }) : undefined}
        />
        <StatCard
          href={salesHref}
          icon={ReceiptText}
          label={t.brand.kpis.orders}
          value={kpis ? formatCount(kpis.total_orders, locale) : "—"}
          loading={data.isLoading}
          extra={trend(kpis?.total_orders, prior?.total_orders)}
          note={kpis ? fill(t.brand.kpis.paid, { count: kpis.paid_orders }) : undefined}
        />
        <StatCard
          href={salesHref}
          icon={Coins}
          label={t.brand.kpis.average}
          value={kpis ? money(kpis.aov) : "—"}
          loading={data.isLoading}
          extra={trend(kpis?.aov, prior?.aov)}
          note={kpis ? fill(t.brand.kpis.perOrder, { count: kpis.average_items_per_order }) : undefined}
        />
        <StatCard
          href={salesHref}
          icon={Ban}
          label={t.brand.kpis.cancelled}
          value={kpis ? formatCount(kpis.cancelled_orders, locale) : "—"}
          loading={data.isLoading}
          extra={trend(kpis?.cancelled_orders, prior?.cancelled_orders, { good: "down" })}
        />
      </div>
      {data.isError ? <p role="alert" className="text-sm text-danger">{data.error.message}</p> : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Panel
            title={t.brand.branches.title}
            icon={Building2}
            action={canReport && branches.length > 1 ? <PanelLink href={reportHref("/app/reports/branches")}>{t.brand.branches.link}</PanelLink> : undefined}
          >
            <DataTable
              stack
              flush
              caption={t.brand.branches.title}
              columns={columns}
              rows={ranking}
              rowKey={(row) => row.branch_id}
              loading={data.isLoading}
              empty={t.brand.branches.empty}
              // A branch row opens that branch's sales for the same period.
              onRowClick={canReport ? (row) => router.push(reportHref("/app/reports/sales", { branch: row.branch_id })) : undefined}
            />
          </Panel>

          <Panel title={t.brand.menu.categories} icon={LayoutGrid}>
            {data.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-24 rounded-staff" />
              </div>
            ) : categories.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-secondary">{t.brand.menu.empty}</p>
            ) : (
              <ul className="grid grid-cols-2">
                {categories.map((category) => (
                  <li key={category.category_id} className="grid min-w-0 gap-1.5 border-b border-border px-3 py-3 odd:border-e sm:px-4">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink">{pickLocale(category.category_name, locale)}</span>
                      <span className="shrink-0 text-ink tabular-nums">{money(category.total_revenue)}</span>
                    </span>
                    <ShareBar value={Number(category.gmv_share_percentage) || 0} max={shareMax} />
                    <span className="text-xs text-ink-secondary tabular-nums">{fill(t.brand.menu.share, { share: Number(category.gmv_share_percentage).toFixed(1) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Panel title={t.brand.menu.top} icon={Trophy} action={canReport ? <PanelLink href={reportHref("/app/reports/menu")}>{t.brand.menu.link}</PanelLink> : undefined}>
            {data.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-40 rounded-staff" />
              </div>
            ) : top.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-secondary">{t.brand.menu.empty}</p>
            ) : (
              <ol className="divide-y divide-border">
                {top.map((item, index) => (
                  <li key={item.item_id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-subtle">
                    <span className="text-xs font-semibold text-ink-secondary tabular-nums">{index + 1}</span>
                    <span className="truncate text-sm font-medium text-ink">{pickLocale(item.item_name, locale)}</span>
                    <span className="text-sm text-ink tabular-nums">{money(item.gross_revenue)}</span>
                    <span />
                    <ShareBar value={item.total_quantity_sold} max={topMax} />
                    <span className="text-xs text-ink-secondary tabular-nums">{fill(t.brand.menu.sold, { count: formatCount(item.total_quantity_sold, locale) })}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <AskBox />
        </div>
      </div>
    </div>
  );
}
