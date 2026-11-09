"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ops/kit/button";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { ErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { csvCell, periodRange, type Period } from "./sheet";
import { branchNow, splitMinutes } from "./time";

type Row = components["schemas"]["TimesheetRow"];

const ZONE = "Africa/Cairo";

const hours = (minutes: number) => (minutes / 60).toFixed(2);

export function TimesheetView({ branchId }: { branchId: string | null }) {
  const t = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const [period, setPeriod] = useState<Period>("thisWeek");
  const today = branchNow(ZONE).day;
  const range = periodRange(period, today);

  const sheet = useQuery({
    queryKey: ["timesheet", branchId, range.start, range.end],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/timesheet", {
        params: { path: { branch_id: branchId! }, query: { start: range.start, end: range.end } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.sheet.failed);
      return result.data;
    },
  });

  if (!branchId) return <p className="text-sm text-ink-secondary">{t.sheet.chooseBranch}</p>;

  const roleName = (role: string | null | undefined) => (role && isUserRole(role) ? roleLabel(role, locale) : (role ?? ""));
  const duration = (minutes: number) => {
    const split = splitMinutes(minutes);
    return fill(t.my.worked, { hours: split.hours, minutes: split.minutes });
  };
  const counted = (count: number, minutes: number) =>
    count > 0 ? <span className="tabular-nums">{fill(t.sheet.times, { count, minutes })}</span> : <span className="text-ink-secondary">—</span>;

  const download = () => {
    if (!sheet.data) return;
    const c = t.sheet.columns;
    const header = [c.name, c.email, c.role, c.days, c.hours, c.scheduled, c.lateCount, c.lateMinutes, c.earlyCount, c.earlyMinutes, c.overtime, c.absent, c.excused, c.off, c.review];
    const lines = sheet.data.rows.map((row) =>
      [
        row.employee_name,
        row.employee_email,
        roleName(row.role),
        row.days_worked ?? 0,
        hours(row.minutes_worked ?? 0),
        hours(row.minutes_scheduled ?? 0),
        row.late_count ?? 0,
        row.minutes_late ?? 0,
        row.early_leave_count ?? 0,
        row.minutes_early_leave ?? 0,
        row.minutes_overtime ?? 0,
        row.absent_count ?? 0,
        row.excused_count ?? 0,
        row.days_off ?? 0,
        row.needs_review_count ?? 0,
      ]
        .map(csvCell)
        .join(","),
    );
    // The byte-order mark lets Excel read Arabic names correctly.
    const blob = new Blob([`﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${t.sheet.file}-${sheet.data.branch_name.replace(/[^\p{L}\p{N}]+/gu, "-")}-${range.start}-${range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Row>[] = [
    {
      key: "person",
      header: t.sheet.person,
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-ink">{row.employee_name}</span>
          <span className="text-xs text-ink-secondary">
            {[
              roleName(row.role),
              row.open_count ? fill(t.sheet.open, { count: row.open_count }) : "",
              row.needs_review_count ? fill(t.sheet.review, { count: row.needs_review_count }) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      ),
    },
    { key: "days", header: t.sheet.days, align: "end", cell: (row) => <span className="tabular-nums">{row.days_worked ?? 0}</span> },
    { key: "hours", header: t.sheet.hours, align: "end", cell: (row) => <span className="font-medium tabular-nums">{duration(row.minutes_worked ?? 0)}</span> },
    { key: "late", header: t.sheet.late, align: "end", cell: (row) => counted(row.late_count ?? 0, row.minutes_late ?? 0) },
    { key: "early", header: t.sheet.early, align: "end", cell: (row) => counted(row.early_leave_count ?? 0, row.minutes_early_leave ?? 0) },
    {
      key: "overtime",
      header: t.sheet.overtime,
      align: "end",
      cell: (row) => (row.minutes_overtime ? <span className="tabular-nums">{duration(row.minutes_overtime)}</span> : <span className="text-ink-secondary">—</span>),
    },
    { key: "absent", header: t.sheet.absent, align: "end", cell: (row) => <span className="tabular-nums">{row.absent_count || "—"}</span> },
    { key: "off", header: t.sheet.off, align: "end", cell: (row) => <span className="tabular-nums">{row.days_off || "—"}</span> },
  ];

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Period>
          label={t.sheet.period}
          value={period}
          onValueChange={setPeriod}
          items={(["thisWeek", "lastWeek", "thisMonth", "lastMonth"] as const).map((value) => ({ value, label: t.sheet[value] }))}
        />
        <Button size="field" variant="secondary" disabled={!sheet.data || sheet.data.rows.length === 0} onClick={download}>
          <Download aria-hidden />
          {t.sheet.download}
        </Button>
      </div>
      {sheet.isError ? (
        <ErrorState body={sheet.error instanceof Error ? sheet.error.message : t.sheet.failed} onRetry={() => void sheet.refetch()} />
      ) : (
        <DataTable caption={t.views.timesheet} columns={columns} rows={sheet.data?.rows ?? []} rowKey={(row) => row.user_id} loading={sheet.isLoading} empty={t.sheet.nobody} />
      )}
    </section>
  );
}
