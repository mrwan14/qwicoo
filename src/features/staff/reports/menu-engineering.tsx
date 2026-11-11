"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Select } from "@/components/ops/kit/field";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { query, staffJson } from "@/lib/api/staff-json";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { analyticsPeriod } from "./period";
import { ReportShell } from "./report-shell";

type Group = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG" | "NO_RECIPE";
type Row = {
  item_id: string;
  item_name: string | Record<string, string>;
  category_id: string | null;
  category_name: string | Record<string, string> | null;
  units_sold: number;
  revenue: string;
  average_price: string | null;
  unit_cost: string | null;
  margin: string | null;
  total_profit: string | null;
  group: Group;
};
type Response = {
  popularity_threshold_units: string;
  average_margin: string | null;
  counts: Record<Group, number>;
  items: Row[];
};

const GROUPS: readonly Group[] = ["STAR", "PLOWHORSE", "PUZZLE", "DOG", "NO_RECIPE"];
const QUADRANTS: readonly Group[] = ["PUZZLE", "STAR", "DOG", "PLOWHORSE"];
const TONE: Record<Group, Tone> = { STAR: "success", PLOWHORSE: "info", PUZZLE: "warning", DOG: "danger", NO_RECIPE: "neutral" };
const SHOWN = 5;

export function MenuEngineeringReport() {
  const t = useStaffSection(reportsCopy);
  const e = t.engineering;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const branches = useScope((state) => state.branches);
  // Profit comes from one branch's recipe costs; someone with a single branch always has one.
  const branch = filters.branch ?? (branches.length === 1 ? (branches[0]?.id ?? null) : null);
  const [group, setGroup] = useState<Group | "all">("all");
  const [category, setCategory] = useState("");
  const period = analyticsPeriod(filters.range);
  const data = useQuery({
    queryKey: ["reports", "menu-engineering", branch, period, category],
    enabled: Boolean(branch),
    queryFn: () =>
      staffJson<Response>(
        `/api/v1/analytics/menu-engineering${query({ branch_id: branch, category_id: category || null, ...period })}`,
        {},
        t.loadFailed,
      ),
  });
  const money = (amount: string | null) => (amount == null ? "—" : formatAmount(amount, undefined, locale));
  const all = data.data?.items ?? [];
  const rows = group === "all" ? all : all.filter((row) => row.group === group);
  const categories = [...new Map(all.filter((row) => row.category_id).map((row) => [row.category_id as string, pickLocale(row.category_name, locale)])).entries()];

  const columns: Column<Row>[] = [
    { key: "item", header: e.item, strong: true, cell: (row) => pickLocale(row.item_name, locale) },
    // Category, price and cost are in the CSV; the table keeps what decides the group.
    { key: "sold", header: e.sold, align: "end", cell: (row) => formatCount(row.units_sold, locale) },
    { key: "margin", header: e.margin, align: "end", cell: (row) => money(row.margin) },
    { key: "profit", header: e.profit, align: "end", cell: (row) => money(row.total_profit) },
    { key: "group", header: e.group, width: 130, cell: (row) => <Badge tone={TONE[row.group]}>{e.groups[row.group]}</Badge> },
  ];

  return (
    <ReportShell
      group="menu"
      title={t.items.engineering.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        branch ? (
          <>
            {(["STAR", "PLOWHORSE", "PUZZLE", "DOG"] as const).map((name) => (
              <KpiCard
                key={name}
                label={e.groups[name]}
                value={data.data ? formatCount(data.data.counts[name] ?? 0, locale) : "—"}
                loading={data.isLoading}
              />
            ))}
          </>
        ) : null
      }
      chartTitle={branch ? e.chart : undefined}
      chart={
        !branch ? (
          <EmptyState title={e.needBranch} />
        ) : data.data ? (
          <div className="grid gap-3">
            <p className="text-sm text-ink-secondary">
              {fill(e.threshold, {
                units: formatCount(Number(data.data.popularity_threshold_units), locale),
                margin: money(data.data.average_margin),
              })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {QUADRANTS.map((name) => {
                const members = all.filter((row) => row.group === name);
                return (
                  <section key={name} className="grid content-start gap-2 rounded-staff border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={TONE[name]}>{e.groups[name]}</Badge>
                      <span className="text-xs text-ink-secondary tabular-nums">{formatCount(members.length, locale)}</span>
                    </div>
                    <p className="text-xs leading-5 text-ink-secondary">{e.advice[name]}</p>
                    <ul className="grid gap-0.5 text-sm">
                      {members.slice(0, SHOWN).map((row) => (
                        <li key={row.item_id} className="truncate">
                          {pickLocale(row.item_name, locale)}
                        </li>
                      ))}
                      {members.length === 0 ? <li className="text-ink-secondary">{e.noneInGroup}</li> : null}
                      {members.length > SHOWN ? <li className="text-xs text-ink-secondary">{fill(e.more, { count: members.length - SHOWN })}</li> : null}
                    </ul>
                  </section>
                );
              })}
            </div>
            {data.data.counts.NO_RECIPE ? (
              <p className="text-xs text-ink-secondary">
                {e.groups.NO_RECIPE}: {formatCount(data.data.counts.NO_RECIPE, locale)} · {e.advice.NO_RECIPE}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={
        branch ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<Group | "all">
                label={e.group}
                value={group}
                onValueChange={setGroup}
                items={[{ value: "all" as const, label: e.all }, ...GROUPS.map((name) => ({ value: name, label: e.groups[name] }))]}
              />
              <Select aria-label={e.category} className="w-auto min-w-48" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t.menu.allCategories}</option>
                {categories.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <DataTable stack caption={t.items.engineering.title} columns={columns} rows={rows} loading={data.isLoading} rowKey={(row) => row.item_id} empty={data.isError ? t.loadFailed : t.empty} />
          </div>
        ) : null
      }
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `menu-engineering-${filters.range.from}-${filters.range.to}.csv`,
          [e.item, e.category, e.sold, e.price, e.cost, e.margin, e.profit, e.group],
          rows.map((row) => [
            pickLocale(row.item_name, locale),
            pickLocale(row.category_name, locale),
            row.units_sold,
            row.average_price,
            row.unit_cost,
            row.margin,
            row.total_profit,
            e.groups[row.group],
          ]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
