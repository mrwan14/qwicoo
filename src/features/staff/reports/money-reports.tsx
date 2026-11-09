"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { BarChart, MeterList } from "@/components/ops/kit/bar-chart";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { MoreOptions } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { FinancialsScreen } from "@/features/staff/backoffice-screen";
import { cairoTime } from "@/features/staff/home/numbers";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import { daysIn, percentChange, previousPeriod } from "./compare";
import { downloadCsv } from "./csv";
import { loadSince, monthsIn } from "./paging";
import { rangeLabel, ReportShell } from "./report-shell";
import { Trend } from "./trend";
import { useReportFilters } from "./use-report-filters";

import { num, useZReports, type ZReport } from "./z-reports";

type DayRange = { from: string; to: string };

function inRange(day: string, range: DayRange): boolean {
  const date = day.slice(0, 10);
  return date >= range.from && date <= range.to;
}

/** Till / Z report: every Z report in the period, the cash it should hold, and the live drawer controls. */
export function TillReport() {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === state.branchId)?.name);
  // Today has no Z report until the day is closed, so Till opens on yesterday and ignores the period carried from other reports.
  const { range, setRange } = useReportFilters("yesterday", { carry: false });
  const { query: reports, rows, complete } = useZReports(range, { compare: false });
  const money = (amount: string | number) => formatAmount(amount, undefined, locale);
  const counts = rows.filter((row) => row.cash_reconciliation?.declared_cash != null).length;
  const counted = rows.reduce((sum, row) => sum + num(row.cash_reconciliation?.declared_cash), 0);
  const difference = rows.reduce((sum, row) => sum + num(row.cash_reconciliation?.cash_variance), 0);
  // The API reports declared cash and the variance; what the drawer should have held is the one minus the other.
  const expected = counted - difference;
  const float = rows.reduce((sum, row) => sum + num(row.cash_reconciliation?.opening_balance), 0);
  const cashSales = rows.reduce((sum, row) => sum + num(row.payment_channels?.cash), 0);
  const short = rows.filter((row) => num(row.cash_reconciliation?.cash_variance) < 0).length;
  const over = rows.filter((row) => num(row.cash_reconciliation?.cash_variance) > 0).length;
  const varianceTone = (value: number): Tone => (value < 0 ? "danger" : value > 0 ? "warning" : "success");

  const columns: Column<ZReport>[] = [
    {
      key: "report",
      header: t.till.report,
      strong: true,
      cell: (row) => (
        <Link href={`/app/reports/till/z/${row.id}`} className="underline-offset-4 hover:underline">
          {row.report_number}
        </Link>
      ),
    },
    { key: "day", header: t.till.day, cell: (row) => rangeLabel(row.business_date.slice(0, 10), row.business_date.slice(0, 10), locale) },
    { key: "gross", header: t.till.gross, align: "end", cell: (row) => money(row.gross_sales) },
    { key: "cash", header: t.till.cash, align: "end", cell: (row) => money(row.payment_channels?.cash ?? "0") },
    { key: "card", header: t.till.card, align: "end", cell: (row) => money(row.payment_channels?.card_pos ?? "0") },
    { key: "counted", header: t.till.counted, align: "end", cell: (row) => (row.cash_reconciliation?.declared_cash ? money(row.cash_reconciliation.declared_cash) : "—") },
    {
      key: "difference",
      header: t.till.differenceCol,
      cell: (row) => {
        const value = num(row.cash_reconciliation?.cash_variance);
        return <Badge tone={varianceTone(value)}>{value === 0 ? t.till.matchesBadge : money(value)}</Badge>;
      },
    },
  ];

  return (
    <ReportShell
      group="money"
      title={t.items.till.title}
      subtitle={[rangeLabel(range.from, range.to, locale), branchName, reports.data && !complete ? t.partial : null].filter(Boolean).join(" · ")}
      filters={<FilterBar date={{ value: range, onChange: setRange }} />}
      kpis={
        <>
          <KpiCard label={t.till.expected} value={reports.data ? money(expected) : "—"} loading={reports.isLoading} note={t.till.expectedNote} />
          <KpiCard label={t.till.counted} value={reports.data ? money(counted) : "—"} loading={reports.isLoading} note={t.till.countedNote} />
          <KpiCard
            label={t.till.difference}
            value={reports.data ? money(difference) : "—"}
            loading={reports.isLoading}
            note={reports.data ? (short ? (short === 1 ? t.till.shortOne : fill(t.till.short, { count: short })) : over ? (over === 1 ? t.till.overOne : fill(t.till.over, { count: over })) : t.till.matches) : undefined}
          />
          <KpiCard label={t.till.closed} value={reports.data ? formatCount(rows.length, locale) : "—"} loading={reports.isLoading} note={reports.data ? fill(t.till.closedNote, { count: counts }) : undefined} />
        </>
      }
      chartTitle={t.till.addsUp}
      chart={
        <dl className="grid gap-3 text-sm">
          {[
            [t.till.float, float],
            [t.till.cashSales, cashSales],
            [t.till.otherMoves, expected - float - cashSales],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">{label}</dt>
              <dd className="text-ink tabular-nums">{money(Number(value))}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 font-semibold">
            <dt>{t.till.result}</dt>
            <dd className="tabular-nums">{money(expected)}</dd>
          </div>
        </dl>
      }
      table={<DataTable stack caption={t.items.till.title} columns={columns} rows={rows} loading={reports.isLoading} rowKey={(row) => row.id} empty={reports.isError ? t.loadFailed : t.empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `z-reports-${range.from}-${range.to}.csv`,
          [t.till.report, t.till.day, t.till.gross, t.till.cash, t.till.card, t.till.online, t.till.counted, t.till.differenceCol],
          rows.map((row) => [
            row.report_number,
            row.business_date.slice(0, 10),
            row.gross_sales,
            row.payment_channels?.cash,
            row.payment_channels?.card_pos,
            row.payment_channels?.online,
            row.cash_reconciliation?.declared_cash,
            row.cash_reconciliation?.cash_variance,
          ]),
        );
        toast.success(t.exported);
      }}
    >
      <MoreOptions label={t.till.drawer} summary={t.till.drawerSummary}>
        <FinancialsScreen />
      </MoreOptions>
    </ReportShell>
  );
}

type AttendanceLog = components["schemas"]["AttendanceLogItem"];

/**
 * The API answers a day, a week or a month around `target_date`. One day asks for that day; any
 * longer range asks for each month it touches and keeps the days in range, so a week that starts
 * on Saturday or crosses into a new month is never cut short.
 */
function attendanceRequests(range: DayRange): { filter_type: string; target_date: string }[] {
  if (range.from === range.to) return [{ filter_type: "daily", target_date: range.from }];
  return monthsIn(range.from, range.to).map((month) => ({ filter_type: "monthly", target_date: month }));
}

export function AttendanceReport() {
  const t = useStaffSection(reportsCopy);
  const labels = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const branches = useScope((state) => state.branches);
  const ids = branches.length > 0 ? branches.map((branch) => branch.id) : branchId ? [branchId] : [];
  const { range, setRange } = useReportFilters();
  const comparison = previousPeriod(range);
  // The same month can be asked for twice when the two periods share it.
  const requests = [...new Map([...attendanceRequests(range), ...attendanceRequests(comparison)].map((query) => [`${query.filter_type}:${query.target_date}`, query])).values()];
  const logs = useQuery({
    queryKey: ["attendance-logs", ids.join(","), range.from, range.to, comparison.from],
    enabled: ids.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        ids.flatMap((id) =>
          requests.map(async (query) => {
            const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-logs", {
              params: { path: { branch_id: id }, query },
            });
            if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
            return result.data.records ?? [];
          }),
        ),
      );
      // Month requests can overlap when the API ignores target_date; keep each record once.
      return [...new Map(pages.flat().map((row) => [row.id, row])).values()];
    },
  });
  const rows = (logs.data ?? []).filter((row) => inRange(row.date, range)).sort((left, right) => right.date.localeCompare(left.date) || left.employee_name.localeCompare(right.employee_name));
  const earlier = (logs.data ?? []).filter((row) => inRange(row.date, comparison));
  const statusKey = (status: string) => status.toUpperCase();
  const tally = (list: readonly AttendanceLog[]) => {
    const count = (status: string) => list.filter((row) => statusKey(row.status) === status).length;
    return { total: list.length, onTime: count("PRESENT") + count("ON_TIME"), late: count("LATE"), absent: count("ABSENT") };
  };
  const { onTime, late, absent } = tally(rows);
  const before = tally(earlier);
  // Without any records last time there is nothing fair to compare with.
  const trend = (now: number, then: number, good: "up" | "down" | "none") =>
    logs.data && before.total > 0 ? <Trend change={percentChange(now, then)} comparison={comparison} good={good} /> : null;
  const tone = (status: string): Tone => (statusKey(status) === "LATE" ? "warning" : statusKey(status) === "ABSENT" ? "danger" : "success");
  const label = (status: string) => {
    const key = statusKey(status);
    if (key === "LATE") return labels.late;
    if (key === "ABSENT") return labels.absent;
    if (key === "PRESENT" || key === "ON_TIME") return labels.onTime;
    return status;
  };
  const columns: Column<AttendanceLog>[] = [
    { key: "person", header: t.attendance.person, strong: true, cell: (row) => row.employee_name },
    ...(branches.length > 1 ? [{ key: "branch", header: t.attendance.branch, cell: (row: AttendanceLog) => row.branch_name } satisfies Column<AttendanceLog>] : []),
    { key: "day", header: t.attendance.day, cell: (row) => rangeLabel(row.date.slice(0, 10), row.date.slice(0, 10), locale) },
    { key: "arrived", header: t.attendance.arrived, cell: (row) => (row.check_in ? cairoTime(row.check_in, locale) : "—") },
    { key: "left", header: t.attendance.left, cell: (row) => (row.check_out ? cairoTime(row.check_out, locale) : "—") },
    { key: "status", header: t.attendance.status, cell: (row) => <Badge tone={tone(row.status)}>{label(row.status)}</Badge> },
  ];
  return (
    <ReportShell
      group="staff"
      title={t.items.attendance.title}
      subtitle={rangeLabel(range.from, range.to, locale)}
      filters={<FilterBar date={{ value: range, onChange: setRange, presets: ["today", "yesterday", "thisWeek", "thisMonth"] }} />}
      kpis={
        <>
          <KpiCard label={t.attendance.records} value={logs.data ? formatCount(rows.length, locale) : "—"} loading={logs.isLoading} trend={trend(rows.length, before.total, "none")} />
          <KpiCard label={t.attendance.onTime} value={logs.data ? formatCount(onTime, locale) : "—"} loading={logs.isLoading} trend={trend(onTime, before.onTime, "up")} />
          <KpiCard label={t.attendance.late} value={logs.data ? formatCount(late, locale) : "—"} loading={logs.isLoading} trend={trend(late, before.late, "down")} />
          <KpiCard label={t.attendance.absent} value={logs.data ? formatCount(absent, locale) : "—"} loading={logs.isLoading} trend={trend(absent, before.absent, "down")} />
        </>
      }
      chartTitle={t.attendance.chart}
      chart={
        rows.length > 0 ? (
          <MeterList
            rows={[
              { key: "on", label: t.attendance.onTime, value: onTime, detail: formatCount(onTime, locale) },
              { key: "late", label: t.attendance.late, value: late, detail: formatCount(late, locale) },
              { key: "absent", label: t.attendance.absent, value: absent, detail: formatCount(absent, locale) },
            ]}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{logs.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.attendance.title} columns={columns} rows={rows} loading={logs.isLoading} rowKey={(row) => row.id} empty={t.empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `attendance-${range.from}-${range.to}.csv`,
          [t.attendance.person, t.attendance.branch, t.attendance.day, t.attendance.arrived, t.attendance.left, t.attendance.status],
          rows.map((row) => [row.employee_name, row.branch_name, row.date.slice(0, 10), row.check_in, row.check_out, label(row.status)]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

type Transaction = components["schemas"]["CashierTransactionItem"];

const cairoDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

type Tender = "cash" | "card" | "online";
const CARD_METHODS = new Set(["CARD_TERMINAL", "POS_TERMINAL"]);

/** Cash, a card on the branch's own terminal, or anything paid online (Paymob, wallets, prepaid). */
export function tenderOf(method: string): Tender {
  if (method === "CASH") return "cash";
  return CARD_METHODS.has(method) ? "card" : "online";
}

/** Completed payments only, split by how they were paid. */
function takings(rows: readonly Transaction[]): Record<Tender | "total", number> {
  const sums = { cash: 0, card: 0, online: 0, total: 0 };
  for (const row of rows) {
    if (row.status !== "COMPLETED") continue;
    const amount = num(row.amount);
    sums[tenderOf(row.payment_method)] += amount;
    sums.total += amount;
  }
  return sums;
}

export function PaymentsReport() {
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const { range, setRange } = useReportFilters();
  const comparison = previousPeriod(range);
  // One load reaches back to the start of the comparison period, so both periods come from the same rows.
  const txns = useQuery({
    queryKey: ["cashier-txns", branchId, "report", comparison.from],
    enabled: Boolean(branchId && me),
    queryFn: () =>
      loadSince<Transaction>({
        from: comparison.from,
        dayOf: (row) => cairoDay(row.created_at),
        load: async (offset, limit) => {
          const result = await browserApi.GET("/api/v1/branches/{branch_id}/cashier-transactions", {
            params: { path: { branch_id: branchId ?? "" }, query: { offset, limit } },
          });
          if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
          return { rows: result.data.records ?? [], total: result.data.total ?? 0 };
        },
      }),
  });
  const all = txns.data?.rows ?? [];
  const rows = all.filter((row) => inRange(cairoDay(row.created_at), range));
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const refunded = rows.filter((row) => row.status === "REFUNDED").reduce((sum, row) => sum + num(row.amount), 0);
  const now = takings(rows);
  const before = takings(all.filter((row) => inRange(cairoDay(row.created_at), comparison)));
  const total = now.total;
  const sumOf = (kind: Tender) => now[kind];
  // A list cut short may be missing the earlier period, so it gets no comparison.
  const trend = (kind: Tender | "total") =>
    txns.data?.complete ? <Trend change={percentChange(now[kind], before[kind])} comparison={comparison} /> : null;
  const byMethod = new Map<string, number>();
  for (const row of completed) byMethod.set(row.payment_method, (byMethod.get(row.payment_method) ?? 0) + num(row.amount));
  const money = (amount: number) => formatAmount(amount, undefined, locale);
  const partial = Boolean(txns.data && !txns.data.complete);
  // Over several days the chart shows takings per day; one day (or more than a month) keeps the split by method.
  const days = daysIn(range.from, range.to);
  const perDay =
    days.length > 1 && days.length <= 31
      ? days.map((day) => ({ day, amount: completed.filter((row) => cairoDay(row.created_at) === day).reduce((sum, row) => sum + num(row.amount), 0) }))
      : null;
  const peakDay = Math.max(0, ...(perDay ?? []).map((entry) => entry.amount));
  const columns: Column<Transaction>[] = [
    { key: "when", header: t.payments.when, cell: (row) => formatCairoDateTime(row.created_at, locale) },
    { key: "method", header: t.payments.method, strong: true, cell: (row) => paymentMethodLabel(row.payment_method, locale) },
    { key: "status", header: t.payments.status, cell: (row) => <Badge tone={row.status === "COMPLETED" ? "success" : row.status === "REFUNDED" || row.status === "FAILED" ? "danger" : "warning"}>{paymentStatusLabel(row.status, locale)}</Badge> },
    { key: "reference", header: t.payments.reference, cell: (row) => row.transaction_reference || "—" },
    { key: "amount", header: t.payments.amount, align: "end", cell: (row) => formatAmount(row.amount, row.currency, locale) },
  ];
  return (
    <ReportShell
      group="money"
      title={t.items.payments.title}
      subtitle={[rangeLabel(range.from, range.to, locale), partial ? fill(t.payments.latest, { count: formatCount(all.length, locale) }) : null].filter(Boolean).join(" · ")}
      filters={<FilterBar date={{ value: range, onChange: setRange }} />}
      kpis={
        <>
          <KpiCard
            label={t.payments.total}
            value={txns.data ? money(total) : "—"}
            loading={txns.isLoading}
            trend={trend("total")}
            note={txns.data ? fill(refunded > 0 ? t.payments.takenRefunded : t.payments.takenNote, { count: formatCount(completed.length, locale), refunded: money(refunded) }) : undefined}
          />
          <KpiCard label={t.payments.cash} value={txns.data ? money(sumOf("cash")) : "—"} loading={txns.isLoading} trend={trend("cash")} />
          <KpiCard label={t.payments.card} value={txns.data ? money(sumOf("card")) : "—"} loading={txns.isLoading} trend={trend("card")} note={t.payments.cardNote} />
          <KpiCard label={t.payments.online} value={txns.data ? money(sumOf("online")) : "—"} loading={txns.isLoading} trend={trend("online")} note={t.payments.onlineNote} />
        </>
      }
      chartTitle={perDay ? t.payments.byDay : t.payments.chart}
      chart={
        perDay && total > 0 ? (
          <BarChart
            label={t.payments.byDay}
            format={(value) => money(value)}
            // The day of the month fits under a narrow bar; the full date is in the table.
            bars={perDay.map(({ day, amount }) => ({ key: day, label: String(Number(day.slice(8, 10))), value: amount, highlight: amount > 0 && amount === peakDay }))}
          />
        ) : byMethod.size > 0 ? (
          <MeterList rows={[...byMethod.entries()].map(([method, amount]) => ({ key: method, label: paymentMethodLabel(method, locale), value: amount, detail: money(amount) }))} />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{txns.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={<DataTable stack caption={t.items.payments.title} columns={columns} rows={rows} loading={txns.isLoading} rowKey={(row) => row.id} empty={t.empty} />}
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `payments-${range.from}-${range.to}.csv`,
          [t.payments.when, t.payments.method, t.payments.status, t.payments.reference, t.payments.amount],
          rows.map((row) => [formatCairoDateTime(row.created_at, locale), paymentMethodLabel(row.payment_method, locale), paymentStatusLabel(row.status, locale), row.transaction_reference, row.amount]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
