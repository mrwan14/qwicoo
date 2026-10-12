"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useLocale } from "@/lib/i18n/locale-store";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canSeeReports } from "./access";
import { InventoryFrame, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { INVENTORY_HREFS } from "./chrome";
import { cairoDayWindow, formatQty, lineValue } from "./qty";

export function OverviewScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const branchId = useScope((state) => state.branchId);
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const reports = Boolean(me && canSeeReports(me.role));
  const stock = useQuery({
    queryKey: ["inventory", "stock", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", {
        params: { path: { warehouse_id: selected } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const day = useMemo(() => cairoDayWindow(), []);
  const usage = useQuery({
    queryKey: ["inventory", "usage-today", branchId, day.start],
    enabled: reports && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/reports/usage", {
        params: { query: { branch_id: branchId, start: day.start, end: day.end } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const jobs = useQuery({
    queryKey: ["inventory", "jobs", "FAILED", branchId],
    enabled: reports && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/deduction-jobs", {
        params: { query: { status: "FAILED", branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  const counts = useMemo(() => {
    const rows = stock.data?.items ?? [];
    return {
      value: rows.reduce((sum, row) => sum + Number(lineValue(row.on_hand, row.avg_cost)), 0).toFixed(2),
      low: rows.filter((row) => row.status === "low").length,
      out: rows.filter((row) => row.status === "out").length,
      negative: rows.filter((row) => row.status === "negative").length,
    };
  }, [stock.data]);
  const used = (usage.data?.ingredients ?? []).reduce((sum, row) => sum + Number(row.theoretical_usage_qty), 0);
  const wasted = (usage.data?.waste_by_reason ?? []).reduce((sum, row) => sum + Number(row.qty), 0);

  return (
    <InventoryFrame page="overview">
      <PageHeader title={t.overview.title} detail={t.overview.detail} />
      {warehouses.isLoading ? <LoadingState label={t.loading} /> : null}
      {warehouses.isError ? <QueryErrorState error={warehouses.error} screen={t.tabs.overview} onRetry={() => void warehouses.refetch()} /> : null}
      {warehouses.data && warehouses.data.length === 0 ? <EmptyState title={t.empty} body={t.stock.empty} /> : null}
      {warehouses.data && warehouses.data.length > 0 ? (
        <div className="grid gap-4">
          <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
          {stock.isLoading ? <LoadingState label={t.loading} /> : null}
          {stock.isError ? <QueryErrorState error={stock.error} screen={t.tabs.stock} onRetry={() => void stock.refetch()} /> : null}
          {stock.data ? (
            <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <Stat label={t.overview.stockValue} value={<Money amount={counts.value} currency={currency} />} />
              <Stat label={t.overview.low} value={formatQty(counts.low, locale)} />
              <Stat label={t.overview.out} value={formatQty(counts.out, locale)} />
              <Stat label={t.overview.negative} value={formatQty(counts.negative, locale)} />
            </dl>
          ) : null}
          {reports && usage.data ? (
            <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              <Stat label={t.overview.usage} value={formatQty(used, locale)} />
              <Stat label={t.overview.waste} value={formatQty(wasted, locale)} />
              <Stat
                label={t.overview.foodCost}
                value={usage.data.food_cost_pct == null ? "—" : `${formatQty(usage.data.food_cost_pct, locale)}%`}
              />
            </dl>
          ) : null}
          {reports && usage.isError ? <QueryErrorState error={usage.error} screen={t.tabs.reports} onRetry={() => void usage.refetch()} /> : null}
          {reports && jobs.data ? (
            <p className="text-sm">
              <span className="font-medium">{t.overview.failedJobs}</span> {formatQty(jobs.data.length, locale)}{" "}
              <Link href={INVENTORY_HREFS.jobs} className="underline">
                {t.overview.jobsLink}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </InventoryFrame>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}
