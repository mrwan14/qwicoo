"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { formatCairoDateTime } from "@/lib/format/time";
import { query, staffJson } from "@/lib/api/staff-json";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { ReportShell } from "./report-shell";

type Shift = {
  id: string;
  status: string;
  opened_by_name: string | null;
  closed_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_balance: string;
  cash_taken: string | null;
  supplier_payouts: string;
  expected: string | null;
  counted: string | null;
  difference: string | null;
  notes: string | null;
};
type ShiftList = { items: Shift[]; shifts: number; closed: number; cash_taken: string; supplier_payouts: string; difference: string };

function bounds(from: string, to: string): { start: string; end: string } {
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${from}T00:00:00Z`, end: end.toISOString() };
}

export function ShiftsDrawersReport() {
  const t = useStaffSection(reportsCopy);
  const h = t.shifts;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const topBranch = useScope((state) => state.branchId);
  // Drawers belong to one branch: the one picked here, else the one in the top bar.
  const branch = filters.branch ?? topBranch;
  const period = bounds(filters.range.from, filters.range.to);
  const data = useQuery({
    queryKey: ["reports", "shifts", branch, period],
    enabled: Boolean(branch),
    queryFn: () =>
      staffJson<ShiftList>(`/api/v1/financials/drawer/sessions${query(period)}`, { headers: { "x-branch-id": branch ?? "" } }, t.loadFailed),
  });
  const money = (amount: string | null | undefined) => (amount == null ? "—" : formatAmount(amount, undefined, locale));
  const signed = (amount: string | null) => {
    if (amount == null) return "—";
    const value = Number(amount);
    return <span className={value < 0 ? "text-danger" : value > 0 ? "text-success" : ""}>{money(amount)}</span>;
  };
  const rows = data.data?.items ?? [];
  const columns: Column<Shift>[] = [
    {
      key: "opened",
      header: h.opened,
      strong: true,
      cell: (row) => (
        <span className="grid">
          {formatCairoDateTime(row.opened_at, locale)}
          <span className="text-xs font-normal text-ink-secondary">{row.opened_by_name ?? ""}</span>
        </span>
      ),
    },
    {
      key: "closed",
      header: h.closed,
      cell: (row) =>
        row.closed_at ? (
          <span className="grid">
            {formatCairoDateTime(row.closed_at, locale)}
            <span className="text-xs text-ink-secondary">{row.closed_by_name ?? ""}</span>
          </span>
        ) : (
          <Badge tone="info">{h.open}</Badge>
        ),
    },
    { key: "opening", header: h.opening, align: "end", cell: (row) => money(row.opening_balance) },
    { key: "taken", header: h.cashTaken, align: "end", cell: (row) => money(row.cash_taken) },
    { key: "payouts", header: h.payouts, align: "end", cell: (row) => money(row.supplier_payouts) },
    { key: "expected", header: h.expected, align: "end", cell: (row) => money(row.expected) },
    { key: "counted", header: h.counted, align: "end", cell: (row) => money(row.counted) },
    { key: "difference", header: h.difference, align: "end", cell: (row) => signed(row.difference) },
  ];

  return (
    <ReportShell
      group="staff"
      title={t.items.shifts.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        branch ? (
          <>
            <KpiCard label={h.shifts} value={data.data ? formatCount(data.data.shifts, locale) : "—"} loading={data.isLoading} />
            <KpiCard label={h.cashTaken} value={data.data ? money(data.data.cash_taken) : "—"} loading={data.isLoading} />
            <KpiCard label={h.payouts} value={data.data ? money(data.data.supplier_payouts) : "—"} loading={data.isLoading} />
            <KpiCard label={h.difference} value={data.data ? signed(data.data.difference) : "—"} note={h.differenceNote} loading={data.isLoading} />
          </>
        ) : null
      }
      table={
        branch ? (
          <DataTable stack caption={t.items.shifts.title} columns={columns} rows={rows} loading={data.isLoading} rowKey={(row) => row.id} empty={data.isError ? t.loadFailed : h.none} />
        ) : (
          <EmptyState title={h.needBranch} />
        )
      }
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `shifts-${filters.range.from}-${filters.range.to}.csv`,
          [h.opened, h.by, h.closed, h.by, h.opening, h.cashTaken, h.payouts, h.expected, h.counted, h.difference, h.notes],
          rows.map((row) => [
            row.opened_at,
            row.opened_by_name,
            row.closed_at,
            row.closed_by_name,
            row.opening_balance,
            row.cash_taken,
            row.supplier_payouts,
            row.expected,
            row.counted,
            row.difference,
            row.notes,
          ]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
