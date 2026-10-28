"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { Card, KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { dateFilter, type DateFilter } from "@/components/ops/kit/date-range";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { MeterList } from "@/components/ops/kit/bar-chart";
import { formatAmount } from "@/components/ops/kit/money";
import { PageHeader } from "@/components/ops/kit/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsPeriod } from "@/features/staff/reports/period";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCount } from "@/lib/i18n/format";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { homeCopy } from "@/lib/i18n/staff/home";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { AskBox } from "./ask-box";
import { cairoHour, greetingKey } from "./numbers";

type BranchRow = components["schemas"]["BranchPerformanceRow"];

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** Brand admin: the brand's sales across every branch, the branch matrix and what sells. */
export function BrandHome() {
  const t = useStaffSection(homeCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandName = useScope((state) => state.brandName) ?? "";
  const branches = useScope((state) => state.branches);
  const branchId = useScope((state) => state.branchId);
  const [range, setRange] = useState<DateFilter>(() => dateFilter("today"));
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);
  const now = useMemo(() => new Date(), []);
  const money = (amount: string) => formatAmount(amount, undefined, locale);
  const period = analyticsPeriod(range);

  const data = useQuery({
    queryKey: ["home", "brand-dashboard", period],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query: period } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const kpis = data.data?.kpis;
  const ranking = data.data?.branch_rankings ?? [];
  const top = (data.data?.top_selling_items ?? []).slice(0, 5);
  const categories = (data.data?.category_breakdown ?? []).slice(0, 4);

  const columns: Column<BranchRow>[] = [
    { key: "branch", header: t.brand.branches.branch, cell: (row) => pickLocale(row.branch_name, locale), strong: true },
    { key: "sales", header: t.brand.branches.sales, cell: (row) => money(row.gmv), align: "end" },
    { key: "orders", header: t.brand.branches.orders, cell: (row) => formatCount(row.total_paid_orders, locale), align: "end" },
    { key: "average", header: t.brand.branches.average, cell: (row) => money(row.aov), align: "end" },
    { key: "cash", header: t.brand.branches.cash, cell: (row) => money(row.cash_revenue), align: "end" },
    { key: "digital", header: t.brand.branches.digital, cell: (row) => money(row.digital_revenue), align: "end" },
    { key: "cancelled", header: t.brand.branches.cancelled, cell: (row) => `${row.cancellation_rate_percentage}%`, align: "end" },
  ];

  if (!me) return null;
  const firstName = me.full_name.split(/\s+/)[0] ?? me.full_name;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <PageHeader
        title={fill(t.greeting[greetingKey(cairoHour(now.toISOString()) ?? 9)], { name: firstName })}
        subtitle={fill(t.brand.subtitle, { brand: brandName, count: branches.length })}
      />
      <FilterBar date={{ value: range, onChange: setRange }} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t.brand.kpis.gross} value={kpis ? money(kpis.gmv) : "—"} loading={data.isLoading} note={kpis ? fill(t.brand.kpis.refunds, { amount: money(kpis.total_refunds) }) : undefined} />
        <KpiCard label={t.brand.kpis.orders} value={kpis ? formatCount(kpis.total_orders, locale) : "—"} loading={data.isLoading} note={kpis ? fill(t.brand.kpis.paid, { count: kpis.paid_orders }) : undefined} />
        <KpiCard label={t.brand.kpis.average} value={kpis ? money(kpis.aov) : "—"} loading={data.isLoading} note={kpis ? fill(t.brand.kpis.perOrder, { count: kpis.average_items_per_order }) : undefined} />
        <KpiCard label={t.brand.kpis.cancelled} value={kpis ? formatCount(kpis.cancelled_orders, locale) : "—"} loading={data.isLoading} />
      </div>
      {data.isError ? <p role="alert" className="text-sm text-danger">{data.error.message}</p> : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title={t.brand.branches.title}
          action={allowed.has("/app/reports/sales") ? <CardLink href="/app/reports/branches">{t.brand.branches.link}</CardLink> : undefined}
        >
          <DataTable
            caption={t.brand.branches.title}
            columns={columns}
            rows={ranking}
            rowKey={(row) => row.branch_id}
            loading={data.isLoading}
            empty={t.brand.branches.empty}
          />
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <Card
            title={t.brand.menu.title}
            action={allowed.has("/app/reports/sales") ? <CardLink href="/app/reports/menu">{t.brand.menu.link}</CardLink> : undefined}
          >
            {data.isLoading ? (
              <Skeleton className="h-40 rounded-staff" />
            ) : top.length === 0 ? (
              <p className="py-4 text-sm text-ink-secondary">{t.brand.menu.empty}</p>
            ) : (
              <MeterList
                rows={top.map((item) => ({
                  key: item.item_id,
                  label: pickLocale(item.item_name, locale),
                  value: item.total_quantity_sold,
                  detail: money(item.gross_revenue),
                  note: fill(t.brand.menu.sold, { count: formatCount(item.total_quantity_sold, locale) }),
                }))}
              />
            )}
            {categories.length > 0 ? (
              <div className="grid gap-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-ink-secondary">{t.brand.menu.categories}</p>
                <ul className="grid gap-1.5">
                  {categories.map((category) => (
                    <li key={category.category_id} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-ink">{pickLocale(category.category_name, locale)}</span>
                      <span className="shrink-0 text-ink-secondary tabular-nums">{fill(t.brand.menu.share, { share: category.gmv_share_percentage })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
          <AskBox />
        </div>
      </div>
    </div>
  );
}
