"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MeterList } from "@/components/ops/kit/bar-chart";
import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import type { DateFilter } from "@/components/ops/kit/date-range";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import {
  fetchReviews,
  fetchWalkouts,
  resolveReview,
  type ReviewRow,
  type WalkoutRow,
} from "@/lib/api/visit-reports";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { useAnalyticsFilters, useSubtitle } from "./analytics-reports";
import { downloadCsv } from "./csv";
import { ReportShell } from "./report-shell";

/** The period as the API wants it: from the start of the first day to the start of the day after the last. */
function periodBounds(range: DateFilter): { start: string; end: string } {
  const end = new Date(`${range.to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${range.from}T00:00:00Z`, end: end.toISOString() };
}

function when(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      numberingSystem: "latn",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StarLine({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={`size-3.5 ${star <= rating ? "fill-warning text-warning" : "text-border"}`}
        />
      ))}
    </span>
  );
}

export function ReviewsReport() {
  const t = useStaffSection(reportsCopy);
  const v = t.visit;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const [lowOnly, setLowOnly] = useState(false);
  const bounds = periodBounds(filters.range);
  const data = useQuery({
    queryKey: ["reports", "reviews", bounds, filters.branch, lowOnly],
    queryFn: () => fetchReviews({ branchId: filters.branch, start: bounds.start, end: bounds.end, lowOnly }, t.loadFailed),
  });
  const handle = useMutation({
    mutationFn: (id: string) => resolveReview(id, "", t.loadFailed),
    onSuccess: () => {
      toast.success(v.handledToast);
      void queryClient.invalidateQueries({ queryKey: ["reports", "reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["reviews-summary"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const page = data.data;
  const rows = page?.items ?? [];
  const starsLabel = (n: number) => fill(n === 1 ? v.star : v.stars, { n });
  const fiveShare = page && page.count > 0 ? Math.round(((page.distribution["5"] ?? 0) / page.count) * 100) : null;
  const columns: Column<ReviewRow>[] = [
    { key: "when", header: v.when, width: 130, cell: (row) => when(row.created_at, locale) },
    { key: "table", header: v.table, width: 90, cell: (row) => (row.table_number ? fill(v.tableN, { n: row.table_number }) : "—") },
    { key: "guest", header: v.guest, width: 110, cell: (row) => (row.guest_name ? <bdi>{row.guest_name}</bdi> : "—") },
    { key: "rating", header: v.rating, width: 110, cell: (row) => <StarLine rating={row.rating} label={starsLabel(row.rating)} /> },
    { key: "comment", header: v.comment, wrap: true, cell: (row) => (row.comment ? <span dir="auto">{row.comment}</span> : v.noComment) },
    {
      key: "status",
      header: v.status,
      width: 170,
      align: "end",
      cell: (row) =>
        !row.is_low ? null : row.resolved_at ? (
          <Badge tone="neutral">{v.handled}</Badge>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Badge tone="danger">{v.low}</Badge>
            <Button size="sm" variant="secondary" disabled={handle.isPending} onClick={() => handle.mutate(row.id)}>
              {handle.isPending && handle.variables === row.id ? v.handling : v.handle}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <ReportShell
      group="guests"
      title={t.items.reviews.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard
            label={v.average}
            value={page?.average != null ? <span dir="ltr">{`${page.average.toFixed(1)} / 5`}</span> : "—"}
            loading={data.isLoading}
          />
          <KpiCard label={v.ratings} value={page ? formatCount(page.count, locale) : "—"} loading={data.isLoading} />
          <KpiCard label={v.toHandle} value={page ? formatCount(page.unresolved_low, locale) : "—"} loading={data.isLoading} />
          <KpiCard label={v.fiveStar} value={fiveShare != null ? `${fiveShare}%` : "—"} loading={data.isLoading} />
        </>
      }
      chartTitle={v.distribution}
      chart={
        page && page.count > 0 ? (
          <MeterList
            rows={[5, 4, 3, 2, 1].map((stars) => ({
              key: String(stars),
              label: starsLabel(stars),
              value: page.distribution[String(stars)] ?? 0,
              detail: formatCount(page.distribution[String(stars)] ?? 0, locale),
            }))}
          />
        ) : (
          <p className="py-6 text-sm text-ink-secondary">{data.isError ? t.loadFailed : t.empty}</p>
        )
      }
      table={
        <div className="grid gap-2">
          <label className="inline-flex w-fit items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
            {v.lowOnly}
          </label>
          <DataTable
            stack
            caption={t.items.reviews.title}
            columns={columns}
            rows={rows}
            loading={data.isLoading}
            rowKey={(row) => row.id}
            empty={data.isError ? t.loadFailed : t.empty}
          />
        </div>
      }
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `reviews-${filters.range.from}-${filters.range.to}.csv`,
          [v.when, v.table, v.guest, v.rating, v.comment, v.status],
          rows.map((row) => [
            row.created_at,
            row.table_number,
            row.guest_name,
            row.rating,
            row.comment,
            row.is_low ? (row.resolved_at ? v.handled : v.low) : "",
          ]),
        );
        toast.success(t.exported);
      }}
    />
  );
}

export function WalkoutsReport() {
  const t = useStaffSection(reportsCopy);
  const v = t.visit;
  const { locale } = useLocale();
  const filters = useAnalyticsFilters();
  const subtitle = useSubtitle(filters.range, filters.branchName);
  const bounds = periodBounds(filters.range);
  const data = useQuery({
    queryKey: ["reports", "walkouts", bounds, filters.branch],
    queryFn: () => fetchWalkouts({ branchId: filters.branch, start: bounds.start, end: bounds.end }, t.loadFailed),
  });
  const money = (amount: string) => formatAmount(amount, undefined, locale);
  const page = data.data;
  const rows = page?.items ?? [];
  const columns: Column<WalkoutRow>[] = [
    { key: "when", header: v.when, width: 140, cell: (row) => when(row.walked_out_at, locale) },
    { key: "table", header: v.table, width: 100, strong: true, cell: (row) => (row.table_number ? fill(v.tableN, { n: row.table_number }) : "—") },
    { key: "amount", header: v.amount, width: 120, align: "end", cell: (row) => money(row.total_amount) },
    { key: "reason", header: v.reason, wrap: true, cell: (row) => (row.reason ? <span dir="auto">{row.reason}</span> : "—") },
    { key: "by", header: v.markedBy, width: 140, cell: (row) => row.marked_by || "—" },
  ];
  return (
    <ReportShell
      group="money"
      title={t.items.walkouts.title}
      subtitle={subtitle}
      filters={<FilterBar date={{ value: filters.range, onChange: filters.setRange }} branch={filters.branchFilter} />}
      kpis={
        <>
          <KpiCard label={v.walkouts} value={page ? formatCount(page.count, locale) : "—"} loading={data.isLoading} />
          <KpiCard label={v.unpaid} value={page ? money(page.amount) : "—"} loading={data.isLoading} />
        </>
      }
      table={
        <DataTable
          stack
          caption={t.items.walkouts.title}
          columns={columns}
          rows={rows}
          loading={data.isLoading}
          rowKey={(row) => row.order_id}
          empty={data.isError ? t.loadFailed : t.empty}
        />
      }
      canExport={rows.length > 0}
      onExport={() => {
        downloadCsv(
          `walkouts-${filters.range.from}-${filters.range.to}.csv`,
          [v.when, v.table, v.amount, v.reason, v.markedBy],
          rows.map((row) => [row.walked_out_at, row.table_number, row.total_amount, row.reason, row.marked_by]),
        );
        toast.success(t.exported);
      }}
    />
  );
}
