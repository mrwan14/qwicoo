"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage } from "./access";
import { InventoryBarChart } from "./charts";
import { downloadText, toCsv } from "./cost";
import { control, InventoryFrame, secondaryButton, useBranchCurrency } from "./chrome";
import { cairoCalendarDay, cairoInclusiveRange, formatQty } from "./qty";

export function ReportsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, "reports"));
  const currency = useBranchCurrency(allowed);
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const today = useMemo(() => cairoCalendarDay(), []);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const range = cairoInclusiveRange(start, end);
  const [scope, setScope] = useState<"branch" | "brand">("branch");
  const report = useQuery({
    queryKey: ["inventory", "report", scope, branchId, brandId, start, end],
    enabled: allowed && Boolean(scope === "branch" ? branchId : brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/reports/usage", {
        params: {
          query: {
            branch_id: scope === "branch" ? branchId : null,
            brand_id: scope === "brand" ? brandId : null,
            start: range.start,
            end: range.end,
          },
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
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
  const name = (value: { [key: string]: unknown }) => pickLocale(value, locale);
  const stocked = (sku: string) => stockedSkus.has(sku);

  async function exportServer() {
    const result = await browserApi.GET("/api/v1/inventory/reports/usage.csv", {
      params: {
        query: {
          branch_id: scope === "branch" ? branchId : null,
          brand_id: scope === "brand" ? brandId : null,
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
      <PageHeader
        title={t.reports.title}
        detail={t.reports.detail}
        action={<button type="button" className={secondaryButton} onClick={() => void exportServer().catch((error) => toast.error(error instanceof Error ? error.message : t.loadFailed))}>{t.reports.exportAll}</button>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">{t.reports.from}</span><input className={control} type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">{t.reports.to}</span><input className={control} type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.reports.scope}</span>
          <select className={control} value={scope} onChange={(event) => setScope(event.target.value as "branch" | "brand")}>
            <option value="branch">{t.reports.thisBranch}</option>
            <option value="brand">{t.reports.wholeBrand}</option>
          </select>
        </label>
      </div>
      {report.isLoading ? <LoadingState label={t.loading} /> : null}
      {report.isError ? <QueryErrorState error={report.error} screen={t.tabs.reports} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="grid gap-6">
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <Stat label={t.reports.valuation} value={<Money amount={data.valuation} currency={currency} />} />
            <Stat label={t.reports.cogs} value={<Money amount={data.cogs} currency={currency} />} />
            <Stat label={t.reports.netSales} value={<Money amount={data.net_sales} currency={currency} />} />
            <Stat label={t.reports.foodCost} value={data.food_cost_pct == null ? "—" : `${formatQty(data.food_cost_pct, locale)}%`} />
          </dl>
          <Section
            title={t.reports.usage}
            onExport={() => downloadText("usage.csv", toCsv([
              [t.ingredient, t.reports.theoretical, t.reports.onHand, t.reports.variance, t.reports.value],
              ...data.ingredients.map((row) => [name(row.name), row.theoretical_usage_qty, row.on_hand, row.count_variance_qty, row.value]),
            ]))}
          >
            <div className="overflow-x-auto bg-card">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    {[t.ingredient, t.reports.theoretical, t.reports.onHand, t.reports.variance, t.reports.value].map((label) => (
                      <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.ingredients.map((row) => (
                    <tr key={row.ingredient_id} className="border-b">
                      <td className="px-3 py-2">{name(row.name)}{row.is_prep ? ` · ${t.prep.item}` : ""}</td>
                      <td className="px-3 py-2 tabular-nums">{formatQty(row.theoretical_usage_qty, locale)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatQty(row.on_hand, locale)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatQty(row.count_variance_qty, locale)}</td>
                      <td className="px-3 py-2"><Money amount={row.value} currency={currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <p className="text-start text-sm text-muted-foreground">{t.reports.driftCaption}</p>
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
                      <bdi className="text-muted-foreground">{row.leaf_skus.join(", ")}</bdi>
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

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
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
