"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { MeterList } from "@/components/ops/kit/bar-chart";
import { Badge } from "@/components/ops/kit/badge";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatCairoDateTime } from "@/lib/format/time";
import { query, staffJson } from "@/lib/api/staff-json";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { stationLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { analyticsPeriod } from "./period";
import { ReportShell } from "./report-shell";

type Timing = { count: number; average: string | null; p90: string | null };
type Speed = {
  sla_minutes: number | null;
  kitchen: Timing & { over_sla: number };
  serve: Timing & { not_recorded: number };
  by_hour: (Timing & { hour: number })[];
  by_station: (Timing & { station: string })[];
  by_type: { fulfillment_type: string; kitchen: Timing; serve: Timing }[];
  slowest: { order_id: string; pickup_number: number | null; fulfillment_type: string; sent_at: string; kitchen_minutes: string; over_sla: boolean }[];
};

export function SpeedOfServiceReport() {
  const t = useStaffSection(reportsCopy);
  const s = t.speed;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const branches = useScope((state) => state.branches);
  const branch = filters.branch ?? (branches.length === 1 ? (branches[0]?.id ?? null) : null);
  const period = analyticsPeriod(filters.range);
  const data = useQuery({
    queryKey: ["reports", "speed", branch, period],
    enabled: Boolean(branch),
    queryFn: () => staffJson<Speed>(`/api/v1/analytics/speed-of-service${query({ branch_id: branch, ...period })}`, {}, t.loadFailed),
  });
  const mins = (value: string | null | undefined) => (value == null ? "—" : fill(s.minutes, { n: value }));
  const kind = (value: string) => s.types_[value] ?? value;
  const speed = data.data;
  const sla = speed?.sla_minutes ?? 0;

  const stationColumns: Column<Speed["by_station"][number]>[] = [
    { key: "station", header: s.station, strong: true, cell: (row) => stationLabel(row.station, locale) || row.station },
    { key: "count", header: s.orders, align: "end", cell: (row) => formatCount(row.count, locale) },
    { key: "avg", header: s.average, align: "end", cell: (row) => mins(row.average) },
    { key: "p90", header: s.slow10, align: "end", cell: (row) => mins(row.p90) },
  ];
  const typeColumns: Column<Speed["by_type"][number]>[] = [
    { key: "type", header: s.type, strong: true, cell: (row) => kind(row.fulfillment_type) },
    { key: "count", header: s.orders, align: "end", cell: (row) => formatCount(row.kitchen.count, locale) },
    { key: "kitchen", header: s.kitchen, align: "end", cell: (row) => mins(row.kitchen.average) },
    { key: "serve", header: s.serve, align: "end", cell: (row) => mins(row.serve.average) },
  ];
  const slowColumns: Column<Speed["slowest"][number]>[] = [
    { key: "order", header: s.order, strong: true, cell: (row) => (row.pickup_number != null ? `#${row.pickup_number}` : row.order_id.slice(0, 8)) },
    { key: "type", header: s.type, cell: (row) => kind(row.fulfillment_type) },
    { key: "sent", header: s.sent, cell: (row) => formatCairoDateTime(row.sent_at, locale) },
    {
      key: "kitchen",
      header: s.kitchen,
      align: "end",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.over_sla ? <Badge tone="danger">{s.overBadge}</Badge> : null}
          {mins(row.kitchen_minutes)}
        </span>
      ),
    },
  ];

  return (
    <ReportShell
      group="service"
      title={t.items.speed.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        branch ? (
          <>
            <KpiCard label={s.kitchenAvg} value={speed ? mins(speed.kitchen.average) : "—"} loading={data.isLoading} />
            <KpiCard label={s.kitchenSlow} value={speed ? mins(speed.kitchen.p90) : "—"} loading={data.isLoading} />
            <KpiCard
              label={sla ? fill(s.overSla, { minutes: sla }) : s.overSlaNoTarget}
              value={speed ? formatCount(speed.kitchen.over_sla, locale) : "—"}
              loading={data.isLoading}
            />
            <KpiCard
              label={s.serveAvg}
              value={speed ? mins(speed.serve.average) : "—"}
              note={speed?.serve.not_recorded ? fill(s.serveNote, { count: speed.serve.not_recorded }) : undefined}
              loading={data.isLoading}
            />
          </>
        ) : null
      }
      chartTitle={branch ? s.byHour : undefined}
      chart={
        !branch ? (
          <EmptyState title={s.needBranch} />
        ) : speed && speed.by_hour.length > 0 ? (
          <MeterList
            rows={speed.by_hour.map((row) => ({
              key: String(row.hour),
              label: `${String(row.hour).padStart(2, "0")}:00`,
              value: Number(row.average ?? 0),
              detail: mins(row.average),
              note: sla && Number(row.average ?? 0) > sla ? s.overBadge : fill(s.ordersCount, { count: formatCount(row.count, locale) }),
            }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : s.noData}</p>
        )
      }
      table={
        branch && speed ? (
          <div className="grid gap-5">
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{s.slowest}</h3>
              <DataTable stack caption={s.slowest} columns={slowColumns} rows={speed.slowest} rowKey={(row) => row.order_id} empty={s.noData} />
            </section>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{s.stations}</h3>
              <DataTable stack caption={s.stations} columns={stationColumns} rows={speed.by_station} rowKey={(row) => row.station} empty={s.noData} />
            </section>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{s.types}</h3>
              <DataTable stack caption={s.types} columns={typeColumns} rows={speed.by_type} rowKey={(row) => row.fulfillment_type} empty={s.noData} />
            </section>
          </div>
        ) : null
      }
      canExport={Boolean(speed && speed.slowest.length > 0)}
      onExport={() => {
        if (!speed) return;
        downloadCsv(
          `speed-of-service-${filters.range.from}-${filters.range.to}.csv`,
          [s.order, s.type, s.sent, s.kitchen],
          speed.slowest.map((row) => [row.pickup_number ?? row.order_id, kind(row.fulfillment_type), row.sent_at, row.kitchen_minutes]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
