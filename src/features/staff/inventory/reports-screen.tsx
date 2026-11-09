"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable } from "@/components/ops/kit/data-table";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { percentChange, pointChange, previousPeriod } from "@/features/staff/reports/compare";
import { Trend } from "@/features/staff/reports/trend";
import { useReportFilters } from "@/features/staff/reports/use-report-filters";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage } from "./access";
import { InventoryBarChart } from "./charts";
import { downloadText, toCsv } from "./cost";
import { InventoryFrame, secondaryButton, useBranchCurrency } from "./chrome";
import { cairoInclusiveRange, formatQty } from "./qty";

export function ReportsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, "reports"));
  const currency = useBranchCurrency(allowed);
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const { range: filter, setRange } = useReportFilters();
  const comparison = previousPeriod(filter);
  const range = cairoInclusiveRange(filter.from, filter.to);
  const [scope, setScope] = useState<"branch" | "brand">("branch");
  const scopeQuery = { branch_id: scope === "branch" ? branchId : null, brand_id: scope === "brand" ? brandId : null };
  const loadUsage = async (from: string, to: string) => {
    const span = cairoInclusiveRange(from, to);
    const result = await browserApi.GET("/api/v1/inventory/reports/usage", { params: { query: { ...scopeQuery, start: span.start, end: span.end } } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
    return result.data;
  };
  const ready = allowed && Boolean(scope === "branch" ? branchId : brandId);
  const report = useQuery({
    queryKey: ["inventory", "report", scope, branchId, brandId, filter.from, filter.to],
    enabled: ready,
    queryFn: () => loadUsage(filter.from, filter.to),
  });
  // The same report for the comparison period, loaded after the main one.
  const earlier = useQuery({
    queryKey: ["inventory", "report", scope, branchId, brandId, comparison.from, comparison.to],
    enabled: ready && report.isSuccess,
    queryFn: () => loadUsage(comparison.from, comparison.to),
  });
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "all"],
    enabled: allowed && Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId ?? "", active_only: false } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const stockedSkus = useMemo(() => {
    const skus = new Set<string>();
    for (const item of ingredients.data ?? []) {
      if (item.deduct_as_prep) skus.add(item.sku);
    }
    return skus;
  }, [ingredients.data]);
  const data = report.data;
  const before = earlier.data;
  const name = (value: { [key: string]: unknown }) => pickLocale(value, locale);
  const stocked = (sku: string) => stockedSkus.has(sku);

  async function exportServer() {
    const result = await browserApi.GET("/api/v1/inventory/reports/usage.csv", {
      params: {
        query: {
          ...scopeQuery,
          start: range.start,
          end: range.end,
        },
      },
      parseAs: "text",
    });
    if (!result.response.ok || typeof result.data !== "string") {
      throw asApiError(result.error, result.response, t.loadFailed, locale);
    }
    downloadText("inventory-usage.csv", result.data);
  }

  return (
    <InventoryFrame page="reports">
      <FilterBar
        date={{ value: filter, onChange: setRange }}
        dropdowns={[
          {
            label: t.reports.scope,
            value: scope,
            onChange: (value) => setScope(value as "branch" | "brand"),
            options: [
              { value: "branch", label: t.reports.thisBranch },
              { value: "brand", label: t.reports.wholeBrand },
            ],
          },
        ]}
        onExport={() => void exportServer().catch((error) => toast.error(error instanceof Error ? error.message : t.loadFailed))}
        exportLabel={t.reports.exportAll}
      />
      {report.isLoading ? <LoadingState label={t.loading} /> : null}
      {report.isError ? <QueryErrorState error={report.error} screen={t.tabs.reports} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Valuation is what is on the shelf now, so it has nothing to compare with. */}
            <KpiCard label={t.reports.valuation} value={<Money amount={data.valuation} currency={currency} />} />
            <KpiCard label={t.reports.cogs} value={<Money amount={data.cogs} currency={currency} />} trend={before ? <Trend change={percentChange(data.cogs, before.cogs)} comparison={comparison} good="none" /> : null} />
            <KpiCard label={t.reports.netSales} value={<Money amount={data.net_sales} currency={currency} />} trend={before ? <Trend change={percentChange(data.net_sales, before.net_sales)} comparison={comparison} /> : null} />
            <KpiCard
              label={t.reports.foodCost}
              value={data.food_cost_pct == null ? "—" : `${formatQty(data.food_cost_pct, locale)}%`}
              trend={before && data.food_cost_pct != null && before.food_cost_pct != null ? <Trend change={pointChange(Number(data.food_cost_pct), Number(before.food_cost_pct))} comparison={comparison} good="down" unit="points" /> : null}
            />
          </div>
          <Section
            title={t.reports.usage}
            onExport={() => downloadText("usage.csv", toCsv([
              [t.ingredient, t.reports.theoretical, t.reports.onHand, t.reports.variance, t.reports.value],
              ...data.ingredients.map((row) => [name(row.name), row.theoretical_usage_qty, row.on_hand, row.count_variance_qty, row.value]),
            ]))}
          >
            <DataTable
              stack
              caption={t.reports.usage}
              rows={data.ingredients}
              rowKey={(row) => row.ingredient_id}
              columns={[
                { key: "name", header: t.ingredient, strong: true, cell: (row) => `${name(row.name)}${row.is_prep ? ` · ${t.prep.item}` : ""}` },
                { key: "theoretical", header: t.reports.theoretical, align: "end", cell: (row) => formatQty(row.theoretical_usage_qty, locale) },
                { key: "onHand", header: t.reports.onHand, align: "end", cell: (row) => formatQty(row.on_hand, locale) },
                { key: "variance", header: t.reports.variance, align: "end", cell: (row) => formatQty(row.count_variance_qty, locale) },
                { key: "value", header: t.reports.value, align: "end", cell: (row) => <Money amount={row.value} currency={currency} /> },
              ]}
            />
          </Section>
          <InventoryBarChart
            title={t.reports.charts.usage}
            caption={t.reports.charts.usageCaption}
            rows={data.top_ingredients.map((row) => ({ label: name(row.name) || row.sku, value: Number(row.theoretical_usage_qty) }))}
          />
          <Section
            title={t.reports.waste}
            onExport={() => downloadText("waste.csv", toCsv([[t.reason, t.quantity], ...data.waste_by_reason.map((row) => [row.reason, row.qty])]))}
          >
            <InventoryBarChart
              title={t.reports.charts.waste}
              caption={t.reports.charts.wasteCaption}
              rows={data.waste_by_reason.map((row) => ({ label: reasonLabel(row.reason, t.waste.reasons), value: Number(row.qty) }))}
            />
          </Section>
          <Section
            title={t.reports.drift}
            onExport={() => downloadText("prep-drift.csv", toCsv([
              [t.ingredient, t.reports.onHand, t.reports.theoretical, "leaves"],
              ...data.prep_drift.items.map((row) => [
                name(row.name) || row.sku,
                row.on_hand,
                row.sale_qty,
                stocked(row.sku) ? "" : row.leaf_skus.join(" "),
              ]),
            ]))}
          >
            <p className="text-start text-sm text-ink-secondary">{t.reports.driftCaption}</p>
            <ul className="grid w-full gap-2 text-sm">
              {data.prep_drift.items.map((row) => {
                const tracked = stocked(row.sku);
                const label = name(row.name);
                return (
                  <li key={row.sku} className="flex w-full flex-wrap items-center gap-2">
                    {label ? <span>{label}</span> : <bdi>{row.sku}</bdi>}
                    {tracked ? (
                      <span className="inline-flex items-center border px-2 py-0.5 text-xs font-medium">{t.reports.stockedPrep}</span>
                    ) : null}
                    <span className="tabular-nums">{formatQty(row.on_hand, locale)}</span>
                    {tracked || row.leaf_skus.length === 0 ? null : (
                      <bdi className="text-ink-secondary">{row.leaf_skus.join(", ")}</bdi>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      ) : null}
      {data && data.ingredients.length === 0 ? <EmptyState title={t.reports.empty} body={t.reports.detail} /> : null}
    </InventoryFrame>
  );
}

function reasonLabel(reason: string, labels: Record<string, string>) {
  return reason in labels ? labels[reason] : reason;
}

function Section({ title, onExport, children }: { title: string; onExport: () => void; children: ReactNode }) {
  const t = useStaffSection(inventoryCopy);
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        <button type="button" className={secondaryButton} onClick={onExport}>{t.reports.exportSection}</button>
      </div>
      {children}
    </section>
  );
}
