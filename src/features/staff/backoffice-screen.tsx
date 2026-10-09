"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { BranchesBarChart, CategoryDonut, ItemsBarChart } from "@/features/staff/analytics-charts";
import { AssistantUsage } from "@/features/staff/assistant/leads-screen";
import { canSeeAssistantUsage } from "@/features/staff/assistant/access";
import { LiveCount } from "@/components/ops/live-fact";
import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { ErrorState, LoadingState, QueryErrorState, RoleUnavailableState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError, isRoleDenied } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { auditActionLabel, auditStatusLabel } from "@/lib/audit-labels";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { pickLocale } from "@/lib/i18n/locale-text";
import { analyticsCopy } from "@/lib/i18n/staff/analytics";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

function cairoBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function attendanceStatusLabel(status: string | null | undefined, labels: {
  notCheckedIn: string;
  onTime: string;
  late: string;
  absent: string;
}): string {
  const value = status?.trim().toUpperCase();
  if (!value || value === "UNKNOWN") return labels.notCheckedIn;
  if (value === "PRESENT") return labels.onTime;
  if (value === "LATE") return labels.late;
  if (value === "ABSENT") return labels.absent;
  return status?.trim() || labels.notCheckedIn;
}

function attendanceHeading(name: string | null | undefined, status: string | null | undefined, labels: {
  notCheckedIn: string;
  onTime: string;
  late: string;
  absent: string;
}): string {
  const label = attendanceStatusLabel(status, labels);
  const who = name?.trim();
  return who ? `${who} · ${label}` : label;
}

const CAIRO_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function TodayHoursNote({ hours, branchId }: { hours: components["schemas"]["OpeningHours"] | null | undefined; branchId: string | null }) {
  const t = useStaffSection(attendanceCopy);
  if (!branchId) return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.chooseBranch}</p>;
  const settings = (
    <Link href={`/app/branches/${branchId}`} className="font-medium text-foreground underline-offset-2 hover:underline">
      {t.branchSettings}
    </Link>
  );
  if (!hours) {
    return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.noHoursBefore} {settings} {t.noHoursAfter}</p>;
  }
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(new Date()).slice(0, 3).toLowerCase();
  const key = CAIRO_WEEKDAYS.find((day) => day.startsWith(weekday)) ?? "mon";
  const range = hours[key]?.[0];
  if (!range) {
    return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.closedToday} {settings}.</p>;
  }
  return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{fill(t.opensToday, { open: range.open.slice(0, 5), close: range.close.slice(0, 5) })} {settings}.</p>;
}

export function FinancialsScreen() {
  const t = useStaffSection(analyticsCopy).till;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const branchId = useScope((state) => state.branchId);
  const [opening, setOpening] = useState("0.00");
  const [counted, setCounted] = useState("0.00");
  const [closeOpen, setCloseOpen] = useState(false);
  const drawer = useQuery({
    queryKey: ["drawer", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/drawer/current");
      if (result.response.status === 404) return null;
      if (!result.response.ok) throw asApiError(result.error, result.response, t.drawerFailed);
      return result.data ?? null;
    },
  });
  const open = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/drawer/open", { body: { opening_balance: opening } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.openFailed);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["drawer"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const close = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/drawer/close", {
        body: { declared_cash_amount: counted, closing_notes: "End of shift" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.closeFailed);
    },
    onSuccess: () => {
      setCloseOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["drawer"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reports = useQuery({
    queryKey: ["z-reports", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/z-reports");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.reportsFailed);
      return result.data.items ?? [];
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/z-report/generate", { body: {} });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.generateFailed);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["z-reports"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isRoleDenied(drawer.error) && isRoleDenied(reports.error)) return <RoleUnavailableState screen={t.screen} />;

  const shiftOpen = drawer.data?.status === "OPEN";
  const reportRows = reports.data ?? [];
  const todayReport = reportRows.some((report) => report.business_date === cairoBusinessDate());

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.intro}</p>
      </div>
      {drawer.isLoading ? <LoadingState label={t.loading} /> : null}
      {drawer.isError ? <QueryErrorState error={drawer.error} screen={t.drawerScreen} onRetry={() => void drawer.refetch()} /> : null}
      {reports.isError ? <QueryErrorState error={reports.error} screen={t.reportsScreen} onRetry={() => void reports.refetch()} /> : null}
      <section className="grid gap-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">{t.drawerTitle}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{t.drawerHint}</p>
          </div>
          <StatusChip tone={shiftOpen ? "ready" : "neutral"}>{shiftOpen ? t.shiftOpen : t.noShift}</StatusChip>
        </div>
        {drawer.data ? (
          <p className="text-sm">
            {t.startedWith} <Money amount={drawer.data.opening_balance} />
            {drawer.data.opened_at ? ` · ${formatCairoDateTime(drawer.data.opened_at, locale)}` : ""}
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            {t.opening}
            <span className="text-sm leading-6 text-muted-foreground">{t.openingHint}</span>
            <input className={control} inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={shiftOpen || open.isPending} onClick={() => open.mutate()}>
              {open.isPending ? t.starting : t.startShift}
            </button>
            {shiftOpen ? <span className="text-sm text-muted-foreground">{t.shiftAlready}</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            {t.counted}
            <span className="text-sm leading-6 text-muted-foreground">{t.countedHint}</span>
            <input className={control} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 rounded-xl border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={!shiftOpen || close.isPending} onClick={() => setCloseOpen(true)}>
              {t.endShift}
            </button>
          </label>
        </div>
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">{t.reportTitle}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.reportHint}</p>
          </div>
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? (todayReport ? t.updating : t.creating) : todayReport ? t.updateToday : t.createReport}
          </button>
        </div>
        {reportRows.length === 0 ? <p className="text-sm text-muted-foreground">{t.noReports}</p> : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.report}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.day}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.grossSales}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((report) => (
                  <tr key={report.id} className="border-b last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-start font-medium">
                      <Link className="underline-offset-2 hover:underline" href={`/app/financials/z/${report.id}`}>{report.report_number}</Link>
                    </th>
                    <td className="px-4 py-3">{report.business_date}</td>
                    <td className="px-4 py-3"><Money amount={report.gross_sales} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmDialog open={closeOpen} onOpenChange={setCloseOpen} title={t.endTitle} description={t.endBody} confirmLabel={t.endShift} onConfirm={() => close.mutate()} />
    </div>
  );
}

export function ZReportScreen({ reportId }: { reportId: string }) {
  const t = useStaffSection(analyticsCopy).z;
  const report = useQuery({
    queryKey: ["z", reportId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/z-report/{report_id}", { params: { path: { report_id: reportId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data;
    },
  });
  if (report.isLoading) return <LoadingState label={t.loading} />;
  if (report.isError) return <ErrorState body={report.error.message} onRetry={() => void report.refetch()} />;
  const data = report.data;
  if (!data) return <ErrorState body={t.missing} onRetry={() => void report.refetch()} />;
  return (
    <article className="grid gap-4">
      <div className="grid gap-1">
        <Link href="/app/financials" className="text-sm text-muted-foreground underline-offset-2 hover:underline print:hidden">{t.back}</Link>
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{data.report_number} · {data.business_date}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t.gross}</dt>
          <dd className="text-lg font-semibold"><Money amount={data.gross_sales} /></dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t.net}</dt>
          <dd className="text-lg font-semibold"><Money amount={data.net_sales} /></dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t.tax}</dt>
          <dd className="text-lg font-semibold"><Money amount={data.total_tax} /></dd>
        </div>
      </dl>
      <button type="button" className="min-h-11 w-fit rounded-xl border px-4 text-sm print:hidden" onClick={() => window.print()}>{t.print}</button>
    </article>
  );
}

const ATTENDANCE_RANGES = ["daily", "weekly", "monthly"] as const;

export function AttendanceScreen() {
  const t = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const branches = useScope((state) => state.branches);
  const watchedBranchIds = branches.length > 0 ? branches.map((branch) => branch.id) : branchId ? [branchId] : [];
  const isAdmin = me?.role === "BRANCH_ADMIN";
  const canReviewStaff =
    me?.role === "REGIONAL_MANAGER" || me?.role === "BRANCH_ADMIN" || me?.role === "CASHIER";
  const canOverride = me?.role === "SUPER_ADMIN" || me?.role === "BRAND_ADMIN";
  const [reason, setReason] = useState("");
  const [logId, setLogId] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof ATTENDANCE_RANGES)[number]>("daily");
  const hoursBranch = useQuery({
    queryKey: ["branch", branchId],
    enabled: Boolean(branchId) && isAdmin,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.branchFailed);
      return result.data;
    },
  });
  const status = useQuery({
    queryKey: ["attendance-me"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-status");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.statusFailed);
      return result.data;
    },
  });
  const logs = useQuery({
    queryKey: ["attendance-logs", watchedBranchIds.join(","), range],
    enabled: canReviewStaff && watchedBranchIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(watchedBranchIds.map(async (id) => {
        const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-logs", {
          params: { path: { branch_id: id }, query: { filter_type: range } },
        });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.logsFailed);
        return result.data.records ?? [];
      }));
      return pages.flat().sort((left, right) => right.date.localeCompare(left.date) || left.employee_name.localeCompare(right.employee_name));
    },
  });
  const txns = useQuery({
    queryKey: ["cashier-txns", branchId],
    enabled: canReviewStaff && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/cashier-transactions", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.transactionsFailed);
      return result.data.records ?? [];
    },
  });
  async function punch(kind: "in" | "out") {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
    }).catch(() => null);
    if (!position) {
      toast.error(t.locationNeeded);
      return;
    }
    const body: components["schemas"]["CheckInRequest"] = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const result = kind === "in"
      ? await browserApi.POST("/api/v1/attendance/check-in", { body })
      : await browserApi.POST("/api/v1/attendance/check-out", { body });
    if (!result.response.ok) {
      const error = asApiError(result.error, result.response, t.attendanceFailed);
      toast.error(error.code === "OUT_OF_GEOFENCE" ? t.outsideBranch : error.message);
      return;
    }
    toast.success(kind === "in" ? t.checkedIn : t.checkedOut);
    void status.refetch();
    void logs.refetch();
  }
  const override = useMutation({
    mutationFn: async () => {
      if (!logId) return;
      const body: components["schemas"]["AttendanceManualOverrideRequest"] = { status: "PRESENT", reason };
      const result = await browserApi.PATCH("/api/v1/attendance-logs/{log_id}/manual-override", {
        params: { path: { log_id: logId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.overrideFailed);
    },
    onSuccess: () => {
      setLogId(null);
      void logs.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t.intro}
          {canReviewStaff ? ` ${t.introReview}` : ""}
        </p>
        {isAdmin && !hoursBranch.isLoading ? <TodayHoursNote hours={hoursBranch.data?.opening_hours} branchId={branchId} /> : null}
      </div>
      {status.isError ? (
        <ErrorState body={status.error instanceof Error ? status.error.message : t.statusFailed} onRetry={() => void status.refetch()} />
      ) : (
        <p className="text-sm">
          {status.isLoading
            ? t.loadingYours
            : attendanceHeading(status.data?.employee_name, status.data?.attendance?.status, t)}
          {status.data?.attendance?.check_in ? ` · ${fill(t.inAt, { time: formatCairoDateTime(status.data.attendance.check_in, locale) })}` : ""}
          {status.data?.attendance?.check_out ? ` · ${fill(t.outAt, { time: formatCairoDateTime(status.data.attendance.check_out, locale) })}` : ""}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="min-h-12 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => void punch("in")}>{t.checkIn}</button>
        <button type="button" className="min-h-12 rounded-lg border px-4 text-sm" onClick={() => void punch("out")}>{t.checkOut}</button>
      </div>
      {canReviewStaff ? (
      <>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-medium">{t.staffTitle}</h2>
          <label className="grid gap-1 text-sm">
            {t.period}
            <select className={control} value={range} onChange={(event) => setRange(event.target.value as typeof range)}>
              {ATTENDANCE_RANGES.map((item) => <option key={item} value={item}>{t.ranges[item]}</option>)}
            </select>
          </label>
        </div>
        {logs.isLoading ? <p className="text-sm text-muted-foreground">{t.loadingLogs}</p> : null}
        {logs.isError ? <ErrorState body={logs.error instanceof Error ? logs.error.message : t.logsFailed} onRetry={() => void logs.refetch()} /> : null}
        {!logs.isLoading && !logs.isError && watchedBranchIds.length === 0 ? <p className="text-sm text-muted-foreground">{t.chooseBranchLogs}</p> : null}
        {!logs.isLoading && !logs.isError && watchedBranchIds.length > 0 && (logs.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t.nobody}</p> : null}
        {(logs.data ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.person}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.branch}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.day}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.arrived}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.left}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.status}</th>
                  {canOverride ? <th scope="col" className="px-4 py-3 text-start font-medium">{t.action}</th> : null}
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).map((log) => (
                  <tr key={log.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-medium">{log.employee_name}</th>
                    <td className="px-4 py-4">{log.branch_name}</td>
                    <td className="px-4 py-4">{log.date}</td>
                    <td className="px-4 py-4">{log.check_in ? formatCairoDateTime(log.check_in, locale) : "—"}</td>
                    <td className="px-4 py-4">{log.check_out ? formatCairoDateTime(log.check_out, locale) : "—"}</td>
                    <td className="px-4 py-4">{attendanceStatusLabel(log.status, t)}</td>
                    {canOverride ? (
                      <td className="px-4 py-4">
                        <button type="button" className="min-h-11 underline" onClick={() => setLogId(log.id)}>{t.correct}</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="grid gap-3">
        <div>
          <h2 className="font-medium">{t.paymentsTitle}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.paymentsHint}</p>
        </div>
        {txns.isLoading ? <p className="text-sm text-muted-foreground">{t.loadingPayments}</p> : null}
        {txns.isError ? <QueryErrorState error={txns.error} screen={t.paymentsScreen} onRetry={() => void txns.refetch()} /> : null}
        {!txns.isLoading && !txns.isError && (txns.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t.noPayments}</p> : null}
        {(txns.data ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.when}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.method}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.status}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {(txns.data ?? []).map((txn) => (
                  <tr key={txn.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-medium">{formatCairoDateTime(txn.created_at, locale)}</th>
                    <td className="px-4 py-4">
                      {paymentMethodLabel(txn.payment_method)}
                      {txn.transaction_reference ? <span className="mt-1 block text-muted-foreground">{txn.transaction_reference}</span> : null}
                    </td>
                    <td className="px-4 py-4">{paymentStatusLabel(txn.status)}</td>
                    <td className="px-4 py-4 font-medium"><Money amount={String(txn.amount)} currency={txn.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      </>
      ) : null}
      {canOverride ? (
        <>
          <ConfirmDialog open={Boolean(logId)} onOpenChange={(open) => !open && setLogId(null)} title={t.correctTitle} description={t.correctBody} confirmLabel={t.correct} onConfirm={() => override.mutate()} />
          {logId ? <textarea className="min-h-20 rounded-lg border px-3 py-2" placeholder={t.reason} value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
        </>
      ) : null}
    </div>
  );
}

const PERIODS = ["today", "yesterday", "last_7_days", "last_30_days"] as const satisfies readonly components["schemas"]["TimePeriod"][];

const MONEY_KPIS = new Set(["gmv", "net_revenue", "total_tax", "total_service_fees", "total_discounts", "total_refunds", "aov"]);

function dashboardOrderCount(data: unknown): number | null {
  if (!data || typeof data !== "object" || !("kpis" in data)) return null;
  const kpis = (data as { kpis?: unknown }).kpis;
  if (!kpis || typeof kpis !== "object" || !("total_orders" in kpis)) return null;
  const count = (kpis as { total_orders?: unknown }).total_orders;
  return typeof count === "number" ? count : null;
}

function chartAmount(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function AnalyticsScreen({ view, embedded = false, branchId }: { view: "dashboard" | "menu" | "branches"; embedded?: boolean; branchId?: string | null }) {
  const t = useStaffSection(analyticsCopy).analytics;
  const { locale } = useLocale();
  const me = useStaffSession();
  const [period, setPeriod] = useState<components["schemas"]["TimePeriod"]>("last_7_days");
  const data = useQuery({
    queryKey: ["analytics", view, period, branchId ?? "all"],
    queryFn: async () => {
      const scoped = branchId ? { period, branch_id: branchId } : { period };
      if (view === "menu") {
        const result = await browserApi.GET("/api/v1/analytics/menu-performance", { params: { query: scoped } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
        return result.data;
      }
      if (view === "branches") {
        const result = await browserApi.GET("/api/v1/analytics/branches-matrix", { params: { query: { period } } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
        return result.data;
      }
      const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query: scoped } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data;
    },
  });
  const tabs = [
    { id: "dashboard", href: "/app/analytics", label: t.tabs.dashboard },
    { id: "menu", href: "/app/analytics/menu", label: t.tabs.menu },
    { id: "branches", href: "/app/analytics/branches", label: t.tabs.branches },
  ] as const;

  const orders = view === "dashboard" ? dashboardOrderCount(data.data) : null;

  return (
    <div className="grid gap-4">
      {embedded && orders != null ? (
        <p className="text-sm text-muted-foreground">
          <LiveCount value={orders} /> {orders === 1 ? t.oneOrder : t.orders}
        </p>
      ) : null}
      {embedded ? null : (
        <>
          <div className="grid gap-1">
            <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.intro}</p>
            {me && canSeeAssistantUsage(me.role) ? <AssistantUsage /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link key={tab.id} className={`inline-flex min-h-11 items-center px-3 text-sm ${tab.id === view ? "bg-primary font-medium text-primary-foreground" : "bg-secondary"}`} href={tab.href}>{tab.label}</Link>
            ))}
          </div>
        </>
      )}
      <label className="grid max-w-xs gap-1 text-sm">
        {t.period}
        <select className={control} value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
          {PERIODS.map((item) => <option key={item} value={item}>{t.periods[item]}</option>)}
        </select>
      </label>
      {data.isLoading ? <LoadingState label={t.loading} /> : null}
      {data.isError ? <ErrorState body={data.error.message} onRetry={() => void data.refetch()} /> : null}
      {data.data && "kpis" in data.data && data.data.kpis && typeof data.data.kpis === "object" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.data.kpis as Record<string, unknown>).map(([key, value]) => (
            <article key={key} className="bg-card p-4">
              <p className="text-sm text-muted-foreground">{key in t.kpis ? t.kpis[key as keyof typeof t.kpis] : key.replaceAll("_", " ")}</p>
              <p className="text-lg font-semibold tabular-nums">{typeof value === "string" && MONEY_KPIS.has(key) ? formatMoney(value, undefined, locale) : String(value ?? "")}</p>
            </article>
          ))}
        </div>
      ) : null}
      {data.data && "top_selling_items" in data.data ? (
        <ItemsBarChart
          title={t.topTitle}
          caption={t.topCaption}
          rows={data.data.top_selling_items.map((item) => ({
            id: item.item_id,
            label: pickLocale(item.item_name, locale),
            quantity: item.total_quantity_sold,
            revenue: item.gross_revenue,
          }))}
        />
      ) : null}
      {data.data && "bottom_selling_items" in data.data ? (
        <ItemsBarChart
          title={t.slowTitle}
          caption={t.slowCaption}
          rows={data.data.bottom_selling_items.map((item) => ({
            id: item.item_id,
            label: pickLocale(item.item_name, locale),
            quantity: item.total_quantity_sold,
            revenue: item.gross_revenue,
          }))}
        />
      ) : null}
      {data.data && "category_breakdown" in data.data ? (
        <CategoryDonut
          rows={data.data.category_breakdown.map((item) => ({
            id: item.category_id,
            label: pickLocale(item.category_name, locale),
            revenue: item.total_revenue,
            share: chartAmount(item.gmv_share_percentage),
            shareLabel: `${item.gmv_share_percentage}%`,
          }))}
        />
      ) : null}
      {data.data && "branches" in data.data ? (
        <BranchesBarChart
          rows={data.data.branches.map((row) => ({
            id: row.branch_id,
            label: pickLocale(row.branch_name, locale),
            gmv: chartAmount(row.gmv),
            cash: chartAmount(row.cash_revenue),
            digital: chartAmount(row.digital_revenue),
            gmvText: formatMoney(row.gmv, undefined, locale),
            cashText: formatMoney(row.cash_revenue, undefined, locale),
            digitalText: formatMoney(row.digital_revenue, undefined, locale),
            orders: row.total_paid_orders,
          }))}
        />
      ) : null}
      {!branchId && data.data && "branch_rankings" in data.data && Array.isArray(data.data.branch_rankings) ? (
        <BranchesBarChart
          rows={(data.data.branch_rankings as components["schemas"]["BranchPerformanceRow"][]).map((row) => ({
            id: row.branch_id,
            label: pickLocale(row.branch_name, locale),
            gmv: chartAmount(row.gmv),
            cash: chartAmount(row.cash_revenue),
            digital: chartAmount(row.digital_revenue),
            gmvText: formatMoney(row.gmv, undefined, locale),
            cashText: formatMoney(row.cash_revenue, undefined, locale),
            digitalText: formatMoney(row.digital_revenue, undefined, locale),
            orders: row.total_paid_orders,
          }))}
        />
      ) : null}
    </div>
  );
}

function auditRoleLabel(role: string | null | undefined, notSignedIn: string): string {
  if (!role || role === "ANONYMOUS") return notSignedIn;
  return isUserRole(role) ? roleLabel(role) : role;
}

export function AuditScreen() {
  const t = useStaffSection(analyticsCopy).audit;
  const { locale } = useLocale();
  const [action, setAction] = useState("");
  const [role, setRole] = useState("");
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/audit/logs", {
        params: { query: { limit: 50 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data;
    },
  });
  const actionNeedle = action.trim().toLowerCase();
  const roleNeedle = role.trim().toLowerCase();
  const rows = (logs.data?.items ?? []).filter((item) => {
    const actionMatches = !actionNeedle || auditActionLabel(item.action).toLowerCase().includes(actionNeedle);
    const roleText = `${auditRoleLabel(item.actor_role, t.notSignedIn)} ${item.actor_role ?? ""}`.toLowerCase();
    const roleMatches = !roleNeedle || roleText.includes(roleNeedle);
    return actionMatches && roleMatches;
  });
  return (
    <div className="grid gap-3">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          {t.what}
          <input className={control} value={action} onChange={(event) => setAction(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          {t.role}
          <input className={control} placeholder={t.rolePlaceholder} value={role} onChange={(event) => setRole(event.target.value)} />
        </label>
      </div>
      {logs.isLoading ? <LoadingState label={t.loading} /> : null}
      {logs.isError ? <ErrorState body={logs.error.message} onRetry={() => void logs.refetch()} /> : null}
      {!logs.isLoading && !logs.isError && rows.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : null}
      <ul className="grid gap-2 lg:hidden">
        {rows.map((item) => (
          <li key={item.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{auditActionLabel(item.action)}</p>
            <p>{auditRoleLabel(item.actor_role, t.notSignedIn)} · {formatCairoDateTime(item.created_at, locale)} · {auditStatusLabel(item.status)}</p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead>
          <tr className="text-start">
            <th className="p-2">{t.when}</th>
            <th className="p-2">{t.what}</th>
            <th className="p-2">{t.role}</th>
            <th className="p-2">{t.result}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{formatCairoDateTime(item.created_at, locale)}</td>
              <td className="p-2">{auditActionLabel(item.action)}</td>
              <td className="p-2">{auditRoleLabel(item.actor_role, t.notSignedIn)}</td>
              <td className="p-2">{auditStatusLabel(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
