"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { BarChart, MeterList } from "@/components/ops/kit/bar-chart";
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
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { percentChange, pointChange, previousPeriod, type Comparison } from "./compare";
import { downloadCsv } from "./csv";
import { loadSince } from "./paging";
import { rangeLabel, ReportShell } from "./report-shell";
import { Trend } from "./trend";
import { useReportFilters } from "./use-report-filters";

export type ZReport = components["schemas"]["ZReportResponse"];

type DayRange = { from: string; to: string };

export const num = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dayOf = (row: ZReport) => row.business_date.slice(0, 10);
const inRange = (row: ZReport, range: DayRange) => dayOf(row) >= range.from && dayOf(row) <= range.to;

export function sumOf(rows: readonly ZReport[], pick: (row: ZReport) => string | number | null | undefined): number {
  return rows.reduce((sum, row) => sum + num(pick(row)), 0);
}

/**
 * The branch's Z reports for a period, plus the period it is compared with. Z reports only exist
 * for closed days, so today joins once its Z report is made.
 */
export function useZReports(range: DateFilter, { compare = true }: { compare?: boolean } = {}) {
  const t = useStaffSection(reportsCopy);
  const branchId = useScope((state) => state.branchId);
  const comparison = previousPeriod(range);
  const from = compare ? comparison.from : range.from;
  const query = useQuery({
    queryKey: ["z-reports", branchId, "since", from],
    queryFn: () =>
      loadSince<ZReport>({
        from,
        dayOf,
        load: async (offset, limit) => {
          const result = await browserApi.GET("/api/v1/financials/z-reports", { params: { query: { offset, limit } } });
          if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
          return { rows: result.data.items ?? [], total: result.data.total ?? 0 };
        },
      }),
  });
  const all = query.data?.rows ?? [];
  const rows = all.filter((row) => inRange(row, range)).sort((left, right) => dayOf(right).localeCompare(dayOf(left)));
  const earlier = all.filter((row) => inRange(row, comparison));
  const complete = query.data?.complete ?? true;
  return {
    query,
    rows,
    earlier,
    comparison,
    complete,
    /** Only when the earlier period was fully loaded and has closed days to compare with. */
    canCompare: Boolean(query.data && complete && earlier.length > 0),
  };
}

/** Frame shared by the reports built from Z reports. */
function useZFrame(fallback: "today" | "yesterday" = "today") {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === state.branchId)?.name);
  const { range, setRange } = useReportFilters(fallback);
  const data = useZReports(range);
  const subtitle = [rangeLabel(range.from, range.to, locale), branchName, t.closedOnly, data.query.data && !data.complete ? t.partial : null].filter(Boolean).join(" · ");
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);
  const dayLabel = (row: ZReport) => rangeLabel(dayOf(row), dayOf(row), locale);
  const empty = data.query.isError ? t.loadFailed : t.zEmpty;
  const filters = <FilterBar date={{ value: range, onChange: setRange }} />;
  return { t, locale, range, data, subtitle, money, dayLabel, empty, filters };
}

function TrendFor({ show, change, comparison, good = "up", unit }: { show: boolean; change: number | null; comparison: Comparison; good?: "up" | "down" | "none"; unit?: "percent" | "points" }) {
  return show ? <Trend change={change} comparison={comparison} good={good} unit={unit} /> : null;
}

function reportLink(row: ZReport) {
  return (
    <Link href={`/app/reports/till/z/${row.id}`} className="underline-offset-4 hover:underline">
      {row.report_number}
    </Link>
  );
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

function Totals({ rows }: { rows: readonly [string, string, boolean?][] }) {
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map(([label, value, strong]) => (
        <div key={label} className={strong ? "flex items-center justify-between gap-3 border-t border-border pt-3 font-semibold" : "flex items-center justify-between gap-3"}>
          <dt className={strong ? undefined : "text-ink-secondary"}>{label}</dt>
          <dd className="text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tax, service charge and delivery fees per closed day, ready for filing. */
export function TaxesReport() {
  const { t, range, data, subtitle, money, dayLabel, empty, filters } = useZFrame();
  const { rows, earlier, comparison, canCompare, query } = data;
  const c = t.taxes;
  const tax = sumOf(rows, (row) => row.total_tax);
  const service = sumOf(rows, (row) => row.total_service_fees);
  const delivery = sumOf(rows, (row) => row.delivery_fees);
  const net = sumOf(rows, (row) => row.net_sales);
  const rate = pct(tax, net);
  const columns: Column<ZReport>[] = [
    { key: "day", header: c.day, strong: true, cell: dayLabel },
    { key: "report", header: c.report, cell: reportLink },
    { key: "net", header: c.net, align: "end", cell: (row) => money(row.net_sales) },
    { key: "tax", header: c.tax, align: "end", cell: (row) => money(row.total_tax) },
    { key: "rate", header: c.rate, align: "end", cell: (row) => { const value = pct(num(row.total_tax), num(row.net_sales)); return value === null ? "—" : `${value.toFixed(1)}%`; } },
    { key: "service", header: c.service, align: "end", cell: (row) => money(row.total_service_fees) },
    { key: "delivery", header: c.delivery, align: "end", cell: (row) => money(row.delivery_fees) },
  ];
  return (
    <ReportShell
      group="money"
      title={t.items.taxes.title}
      subtitle={subtitle}
      filters={filters}
      kpis={
        <>
          <KpiCard label={c.tax} value={query.data ? money(tax) : "—"} loading={query.isLoading} note={rate !== null ? fill(c.rateNote, { rate: rate.toFixed(1) }) : undefined} trend={<TrendFor show={canCompare} change={percentChange(tax, sumOf(earlier, (row) => row.total_tax))} comparison={comparison} good="none" />} />
          <KpiCard label={c.service} value={query.data ? money(service) : "—"} loading={query.isLoading} trend={<TrendFor show={canCompare} change={percentChange(service, sumOf(earlier, (row) => row.total_service_fees))} comparison={comparison} good="none" />} />
          <KpiCard label={c.delivery} value={query.data ? money(delivery) : "—"} loading={query.isLoading} trend={<TrendFor show={canCompare} change={percentChange(delivery, sumOf(earlier, (row) => row.delivery_fees))} comparison={comparison} good="none" />} />
          <KpiCard label={c.net} value={query.data ? money(net) : "—"} loading={query.isLoading} note={c.netNote} trend={<TrendFor show={canCompare} change={percentChange(net, sumOf(earlier, (row) => row.net_sales))} comparison={comparison} />} />
        </>
      }
      chartTitle={c.chart}
      chart={
        rows.length > 0 ? (
          <Totals
            rows={[
              [c.gross, money(sumOf(rows, (row) => row.gross_sales))],
              [c.discounts, money(sumOf(rows, (row) => row.total_discounts))],
              [c.refunds, money(sumOf(rows, (row) => row.total_refunds))],
              [c.net, money(net)],
              [c.tax, money(tax)],
              [c.service, money(service)],
              [c.delivery, money(delivery)],
              [c.toFile, money(tax + service), true],
            ]}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.taxes.title} columns={columns} rows={rows} loading={query.isLoading} rowKey={(row) => row.id} empty={empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `taxes-${range.from}-${range.to}.csv`,
          [c.day, c.report, c.gross, c.discounts, c.refunds, c.net, c.tax, c.service, c.delivery],
          rows.map((row) => [dayOf(row), row.report_number, row.gross_sales, row.total_discounts, row.total_refunds, row.net_sales, row.total_tax, row.total_service_fees, row.delivery_fees]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

type Channel = "cashier_pos" | "qr_customer" | "takeaway_app";
const CHANNELS: readonly Channel[] = ["cashier_pos", "qr_customer", "takeaway_app"];

/** Where sales came from: the cashier, guests ordering by QR, or the takeaway app. */
export function ChannelsReport() {
  const { t, range, data, subtitle, money, dayLabel, empty, filters } = useZFrame();
  const { rows, earlier, comparison, canCompare, query } = data;
  const c = t.channels;
  const label: Record<Channel, string> = { cashier_pos: c.cashier, qr_customer: c.qr, takeaway_app: c.app };
  const by = (list: readonly ZReport[], channel: Channel) => sumOf(list, (row) => row.order_sources?.[channel]);
  const total = (list: readonly ZReport[]) => CHANNELS.reduce((sum, channel) => sum + by(list, channel), 0);
  const selfShare = (list: readonly ZReport[]) => pct(by(list, "qr_customer") + by(list, "takeaway_app"), total(list));
  const all = total(rows);
  const share = selfShare(rows);
  const columns: Column<ZReport>[] = [
    { key: "day", header: c.day, strong: true, cell: dayLabel },
    ...CHANNELS.map((channel) => ({ key: channel, header: label[channel], align: "end" as const, cell: (row: ZReport) => money(row.order_sources?.[channel] ?? 0) })),
    { key: "total", header: c.total, align: "end", cell: (row) => money(total([row])) },
    { key: "share", header: c.selfShare, align: "end", cell: (row) => { const value = selfShare([row]); return value === null ? "—" : `${value.toFixed(0)}%`; } },
  ];
  return (
    <ReportShell
      group="sales"
      title={t.items.channels.title}
      subtitle={subtitle}
      filters={filters}
      kpis={
        <>
          {CHANNELS.map((channel) => (
            <KpiCard
              key={channel}
              label={label[channel]}
              value={query.data ? money(by(rows, channel)) : "—"}
              loading={query.isLoading}
              note={all > 0 ? fill(c.ofSales, { share: ((by(rows, channel) / all) * 100).toFixed(0) }) : undefined}
              trend={<TrendFor show={canCompare} change={percentChange(by(rows, channel), by(earlier, channel))} comparison={comparison} />}
            />
          ))}
          <KpiCard
            label={c.selfShare}
            value={share !== null ? `${share.toFixed(0)}%` : "—"}
            loading={query.isLoading}
            note={c.selfShareNote}
            trend={<TrendFor show={canCompare} change={pointChange(share, selfShare(earlier))} comparison={comparison} unit="points" />}
          />
        </>
      }
      chartTitle={c.chart}
      chart={
        all > 0 ? (
          <MeterList rows={CHANNELS.map((channel) => ({ key: channel, label: label[channel], value: by(rows, channel), detail: money(by(rows, channel)), note: `${((by(rows, channel) / all) * 100).toFixed(0)}%` }))} />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.channels.title} columns={columns} rows={rows} loading={query.isLoading} rowKey={(row) => row.id} empty={empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `channels-${range.from}-${range.to}.csv`,
          [c.day, ...CHANNELS.map((channel) => label[channel]), c.total],
          rows.map((row) => [dayOf(row), ...CHANNELS.map((channel) => row.order_sources?.[channel] ?? ""), total([row])]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

/** Money given away: discounts and refunds, with cancelled and refunded orders. */
export function DiscountsReport() {
  const { t, locale, range, data, subtitle, money, dayLabel, empty, filters } = useZFrame();
  const { rows, earlier, comparison, canCompare, query } = data;
  const c = t.discounts;
  const discounts = sumOf(rows, (row) => row.total_discounts);
  const refunds = sumOf(rows, (row) => row.total_refunds);
  const gross = sumOf(rows, (row) => row.gross_sales);
  const given = pct(discounts + refunds, gross);
  const givenBefore = pct(sumOf(earlier, (row) => row.total_discounts) + sumOf(earlier, (row) => row.total_refunds), sumOf(earlier, (row) => row.gross_sales));
  const cancelled = sumOf(rows, (row) => row.order_volumes?.cancelled_orders);
  const refundedOrders = sumOf(rows, (row) => row.order_volumes?.refunded_orders);
  const orders = sumOf(rows, (row) => row.order_volumes?.total_orders);
  const columns: Column<ZReport>[] = [
    { key: "day", header: c.day, strong: true, cell: dayLabel },
    { key: "report", header: c.report, cell: reportLink },
    { key: "gross", header: c.gross, align: "end", cell: (row) => money(row.gross_sales) },
    { key: "discounts", header: c.discounts, align: "end", cell: (row) => money(row.total_discounts) },
    { key: "refunds", header: c.refunds, align: "end", cell: (row) => money(row.total_refunds) },
    { key: "given", header: c.given, align: "end", cell: (row) => { const value = pct(num(row.total_discounts) + num(row.total_refunds), num(row.gross_sales)); return value === null ? "—" : `${value.toFixed(1)}%`; } },
    { key: "cancelled", header: c.cancelled, align: "end", cell: (row) => formatCount(row.order_volumes?.cancelled_orders ?? 0, locale) },
    { key: "refundedOrders", header: c.refundedOrders, align: "end", cell: (row) => formatCount(row.order_volumes?.refunded_orders ?? 0, locale) },
  ];
  const byDay = [...rows].reverse().map((row) => ({ row, value: num(row.total_discounts) + num(row.total_refunds) }));
  const peak = Math.max(0, ...byDay.map((entry) => entry.value));
  return (
    <ReportShell
      group="money"
      title={t.items.discounts.title}
      subtitle={subtitle}
      filters={filters}
      kpis={
        <>
          <KpiCard label={c.discounts} value={query.data ? money(discounts) : "—"} loading={query.isLoading} trend={<TrendFor show={canCompare} change={percentChange(discounts, sumOf(earlier, (row) => row.total_discounts))} comparison={comparison} good="none" />} />
          <KpiCard label={c.refunds} value={query.data ? money(refunds) : "—"} loading={query.isLoading} note={query.data ? fill(c.refundedNote, { count: formatCount(refundedOrders, locale) }) : undefined} trend={<TrendFor show={canCompare} change={percentChange(refunds, sumOf(earlier, (row) => row.total_refunds))} comparison={comparison} good="down" />} />
          <KpiCard label={c.given} value={given !== null ? `${given.toFixed(1)}%` : "—"} loading={query.isLoading} note={c.givenNote} trend={<TrendFor show={canCompare} change={pointChange(given, givenBefore)} comparison={comparison} good="down" unit="points" />} />
          <KpiCard
            label={c.cancelled}
            value={query.data ? formatCount(cancelled, locale) : "—"}
            loading={query.isLoading}
            note={orders > 0 ? fill(c.cancelledNote, { share: ((cancelled / orders) * 100).toFixed(1) }) : undefined}
            trend={<TrendFor show={canCompare} change={percentChange(cancelled, sumOf(earlier, (row) => row.order_volumes?.cancelled_orders))} comparison={comparison} good="down" />}
          />
        </>
      }
      chartTitle={c.chart}
      chart={
        rows.length > 0 ? (
          <BarChart
            label={c.chart}
            format={(value) => money(value)}
            // The day of the month fits under a narrow bar; the full date is in the tooltip and the table.
            bars={byDay.map(({ row, value }) => ({ key: row.id, label: String(Number(dayOf(row).slice(8, 10))), value, highlight: value > 0 && value === peak }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.discounts.title} columns={columns} rows={rows} loading={query.isLoading} rowKey={(row) => row.id} empty={empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `discounts-refunds-${range.from}-${range.to}.csv`,
          [c.day, c.report, c.gross, c.discounts, c.refunds, c.cancelled, c.refundedOrders],
          rows.map((row) => [dayOf(row), row.report_number, row.gross_sales, row.total_discounts, row.total_refunds, row.order_volumes?.cancelled_orders, row.order_volumes?.refunded_orders]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
