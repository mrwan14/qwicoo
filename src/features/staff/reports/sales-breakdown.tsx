"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { Select } from "@/components/ops/kit/field";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { query, staffJson } from "@/lib/api/staff-json";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { analyticsPeriod } from "./period";
import { ReportShell } from "./report-shell";
import { busiest, heatLevel, hourSpan } from "./sales-grid";

type Cell = { weekday: number; hour: number; orders: number; revenue: string };
type Day = { date: string; orders: number; revenue: string };
type Breakdown = { grid: Cell[]; days: Day[] };
type ItemSort = "units" | "revenue";

export function SalesBreakdownReport() {
  const t = useStaffSection(reportsCopy);
  const c = t.salesBy;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const period = analyticsPeriod(filters.range);
  const scope = { ...period, ...(filters.branch ? { branch_id: filters.branch } : {}) };
  const [sort, setSort] = useState<ItemSort>("units");
  const [category, setCategory] = useState("");
  const data = useQuery({
    queryKey: ["reports", "sales-breakdown", scope],
    queryFn: () => staffJson<Breakdown>(`/api/v1/analytics/sales-breakdown${query(scope)}`, {}, t.loadFailed),
  });
  const items = useQuery({
    queryKey: ["reports", "sales-breakdown-items", scope, sort, category],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/analytics/menu-performance", {
        params: { query: { ...scope, sort, limit: 100, ...(category ? { category_id: category } : {}) } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);
  const grid = data.data?.grid ?? [];
  const days = data.data?.days ?? [];
  const top = busiest(grid);
  const topDay = [...days].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];
  const orders = days.reduce((sum, day) => sum + day.orders, 0);
  const revenue = days.reduce((sum, day) => sum + Number(day.revenue), 0);
  const [firstHour, lastHour] = hourSpan(grid);
  const max = Math.max(0, ...grid.map((cell) => Number(cell.revenue)));
  const byKey = new Map(grid.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));
  const hours = Array.from({ length: Math.max(0, lastHour - firstHour + 1) }, (_, index) => firstHour + index);
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short", numberingSystem: "latn" }).format(new Date(`${iso}T12:00:00Z`));

  const dayColumns: Column<Day>[] = [
    { key: "date", header: c.date, strong: true, cell: (row) => dayLabel(row.date) },
    { key: "orders", header: c.orders, align: "end", cell: (row) => formatCount(row.orders, locale) },
    { key: "revenue", header: c.revenue, align: "end", cell: (row) => money(row.revenue) },
  ];
  const itemRows = items.data?.top_selling_items ?? [];
  const itemColumns: Column<(typeof itemRows)[number]>[] = [
    { key: "item", header: c.item, strong: true, cell: (row) => pickLocale(row.item_name, locale) },
    { key: "category", header: c.category, cell: (row) => pickLocale(row.category_name, locale) || "—" },
    { key: "sold", header: c.sold, align: "end", cell: (row) => formatCount(row.total_quantity_sold, locale) },
    { key: "revenue", header: c.revenue, align: "end", cell: (row) => money(row.gross_revenue) },
  ];
  const categories = (items.data?.category_breakdown ?? []).map((entry) => [entry.category_id, pickLocale(entry.category_name, locale)] as const);

  return (
    <ReportShell
      group="sales"
      title={t.items.salesBy.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard label={c.busiestDay} value={topDay ? dayLabel(topDay.date) : "—"} note={topDay ? money(topDay.revenue) : undefined} loading={data.isLoading} />
          <KpiCard
            label={c.busiestHour}
            value={top ? `${c.days[top.weekday]} ${String(top.hour).padStart(2, "0")}:00` : "—"}
            note={top ? money(top.revenue) : undefined}
            loading={data.isLoading}
          />
          <KpiCard label={c.orders} value={data.data ? formatCount(orders, locale) : "—"} loading={data.isLoading} />
          <KpiCard label={c.perDay} value={days.length ? money(revenue / days.length) : "—"} loading={data.isLoading} />
        </>
      }
      chartTitle={c.heatmap}
      chart={
        grid.length === 0 ? (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : c.none}</p>
        ) : (
          <div className="grid gap-2">
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-[3px] text-[11px]" aria-label={c.heatmap}>
                <thead>
                  <tr>
                    <th />
                    {hours.map((hour) => (
                      <th key={hour} scope="col" className="px-0.5 font-normal tabular-nums text-ink-secondary">
                        {hour}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.days.map((name, weekday) => (
                    <tr key={name}>
                      <th scope="row" className="pe-2 text-start font-medium text-ink-secondary">
                        {name}
                      </th>
                      {hours.map((hour) => {
                        const cell = byKey.get(`${weekday}-${hour}`);
                        const level = heatLevel(cell ? Number(cell.revenue) : 0, max);
                        const label = fill(c.cell, { day: c.daysLong[weekday], hour, orders: cell?.orders ?? 0, amount: money(cell?.revenue ?? 0) });
                        return (
                          <td key={hour} title={label} aria-label={label} className="size-6 rounded-[4px] bg-ink" style={{ opacity: level === 0 ? 0.06 : 0.15 + level * 0.2 }} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-secondary">{c.heatmapHint}</p>
          </div>
        )
      }
      table={
        <div className="grid gap-5">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">{c.perDayTitle}</h3>
            <DataTable stack caption={c.perDayTitle} columns={dayColumns} rows={days} loading={data.isLoading} rowKey={(row) => row.date} empty={c.none} />
          </section>
          <section className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{c.itemsTitle}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl<ItemSort>
                  label={c.itemsTitle}
                  value={sort}
                  onValueChange={setSort}
                  items={[
                    { value: "units", label: c.byUnits },
                    { value: "revenue", label: c.byRevenue },
                  ]}
                />
                <Select aria-label={c.category} className="w-auto min-w-44" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">{c.allCategories}</option>
                  {categories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <DataTable stack caption={c.itemsTitle} columns={itemColumns} rows={itemRows} loading={items.isLoading} rowKey={(row) => row.item_id} empty={c.none} />
          </section>
        </div>
      }
      canExport={days.length > 0}
      onExport={() => {
        downloadCsv(
          `sales-by-day-${filters.range.from}-${filters.range.to}.csv`,
          [c.date, c.orders, c.revenue],
          days.map((row) => [row.date, row.orders, row.revenue]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
