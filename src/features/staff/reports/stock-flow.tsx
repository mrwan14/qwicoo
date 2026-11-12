"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { formatQty } from "@/features/staff/inventory/qty";
import { query, staffJson } from "@/lib/api/staff-json";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { ReportShell } from "./report-shell";

const COLUMNS = ["opening", "received", "sold", "waste", "transfer_in", "transfer_out", "prep", "variance", "closing"] as const;
type Key = (typeof COLUMNS)[number];
type FlowRow = { ingredient_id: string; sku: string; name: Record<string, string> | null; unit_code: string } & Record<`${Key}_qty` | `${Key}_value`, string>;
type Flow = { items: FlowRow[]; totals: Record<string, string> };
type Mode = "qty" | "value";

/** The period as the API wants it: from the first day's start to the start of the day after the last (UTC days). */
function bounds(from: string, to: string): { start: string; end: string } {
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${from}T00:00:00Z`, end: end.toISOString() };
}

export function StockFlowReport() {
  const t = useStaffSection(reportsCopy);
  const f = t.stockFlow;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const brandId = useScope((state) => state.brandId);
  const [mode, setMode] = useState<Mode>("qty");
  const period = bounds(filters.range.from, filters.range.to);
  const where = filters.branch ? { branch_id: filters.branch } : brandId ? { brand_id: brandId } : {};
  const data = useQuery({
    queryKey: ["reports", "stock-flow", period, where],
    queryFn: () => staffJson<Flow>(`/api/v1/inventory/reports/flow${query({ ...where, ...period })}`, {}, t.loadFailed),
  });
  const money = (amount: string | undefined) => (amount == null ? "—" : formatAmount(amount, undefined, locale));
  // Whole pounds on the cards so long totals fit; the table keeps piastres.
  const whole = (amount: string | undefined) => (amount == null ? "—" : formatAmount(Math.round(Number(amount)), undefined, locale));
  const show = (row: FlowRow, key: Key) =>
    mode === "qty" ? `${formatQty(row[`${key}_qty`], locale)} ${row.unit_code}` : money(row[`${key}_value`]);
  const net = (row: FlowRow, a: Key, b: Key) => {
    const value = Number(row[`${a}_${mode}`]) - Number(row[`${b}_${mode}`]);
    return mode === "qty" ? `${formatQty(String(value), locale)} ${row.unit_code}` : money(String(value));
  };
  const rows = data.data?.items ?? [];
  const totals = data.data?.totals ?? {};
  const columns: Column<FlowRow>[] = [
    { key: "item", header: f.item, strong: true, cell: (row) => pickLocale(row.name, locale) || row.sku },
    { key: "opening", header: f.opening, align: "end", cell: (row) => show(row, "opening") },
    { key: "received", header: f.received, align: "end", cell: (row) => show(row, "received") },
    { key: "sold", header: f.sold, align: "end", cell: (row) => show(row, "sold") },
    { key: "waste", header: f.waste, align: "end", cell: (row) => show(row, "waste") },
    // Transfers are in minus out; prep and variance are net. The CSV has each part.
    { key: "transfers", header: f.transfers, align: "end", cell: (row) => net(row, "transfer_in", "transfer_out") },
    { key: "prep", header: f.prep, align: "end", cell: (row) => show(row, "prep") },
    { key: "variance", header: f.variance, align: "end", cell: (row) => show(row, "variance") },
    { key: "closing", header: f.closing, align: "end", cell: (row) => show(row, "closing") },
  ];

  return (
    <ReportShell
      group="stock"
      title={t.items.stockFlow.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard label={f.openingValue} value={data.data ? whole(totals.opening_value) : "—"} loading={data.isLoading} />
          <KpiCard label={f.receivedValue} value={data.data ? whole(totals.received_value) : "—"} loading={data.isLoading} />
          <KpiCard label={f.wasteValue} value={data.data ? whole(totals.waste_value) : "—"} loading={data.isLoading} />
          <KpiCard label={f.closingValue} value={data.data ? whole(totals.closing_value) : "—"} loading={data.isLoading} />
        </>
      }
      table={
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<Mode>
              label={f.show}
              value={mode}
              onValueChange={setMode}
              items={[
                { value: "qty", label: f.units },
                { value: "value", label: f.value },
              ]}
            />
            <p className="text-xs text-ink-secondary">{f.hint}</p>
          </div>
          <DataTable stack caption={t.items.stockFlow.title} columns={columns} rows={rows} loading={data.isLoading} rowKey={(row) => row.ingredient_id} empty={data.isError ? t.loadFailed : f.none} />
        </div>
      }
      canExport={rows.length > 0}
      onExport={() => {
        const header = ["sku", f.item, "unit", ...COLUMNS.flatMap((key) => [`${key}_qty`, `${key}_value`])];
        downloadCsv(
          `stock-flow-${filters.range.from}-${filters.range.to}.csv`,
          header,
          rows.map((row) => [row.sku, pickLocale(row.name, locale), row.unit_code, ...COLUMNS.flatMap((key) => [row[`${key}_qty`], row[`${key}_value`]])]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
