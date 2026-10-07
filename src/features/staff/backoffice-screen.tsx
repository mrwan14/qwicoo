"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { BranchesBarChart, CategoryDonut, ItemsBarChart } from "@/features/staff/analytics-charts";
import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { ErrorState, LoadingState, QueryErrorState, RoleUnavailableState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError, isRoleDenied } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { auditActionLabel, auditStatusLabel } from "@/lib/audit-labels";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { formatCairoDateTime } from "@/lib/format/time";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

function cairoBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function attendanceStatusLabel(status: string | null | undefined): string {
  const value = status?.trim().toUpperCase();
  if (!value || value === "UNKNOWN") return "Not checked in";
  if (value === "PRESENT") return "On time";
  if (value === "LATE") return "Late";
  if (value === "ABSENT") return "Absent";
  return status?.trim() || "Not checked in";
}

function attendanceHeading(name: string | null | undefined, status: string | null | undefined): string {
  const label = attendanceStatusLabel(status);
  const who = name?.trim();
  return who ? `${who} · ${label}` : label;
}

const CAIRO_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function TodayHoursNote({ hours, branchId }: { hours: components["schemas"]["OpeningHours"] | null | undefined; branchId: string | null }) {
  if (!branchId) return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Choose a branch. Your check-in uses that branch&apos;s opening time.</p>;
  const settings = (
    <Link href={`/app/branches/${branchId}`} className="font-medium text-foreground underline-offset-2 hover:underline">
      Branch settings
    </Link>
  );
  if (!hours) {
    return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">No operating hours are set yet. Open {settings} and choose Operating hours. Until then, arriving by 10:00 counts as on time.</p>;
  }
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(new Date()).slice(0, 3).toLowerCase();
  const key = CAIRO_WEEKDAYS.find((day) => day.startsWith(weekday)) ?? "mon";
  const range = hours[key]?.[0];
  if (!range) {
    return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">This branch is closed today, so arriving by 10:00 counts as on time. Change the day in {settings}.</p>;
  }
  return <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Today this branch opens at {range.open.slice(0, 5)} and closes at {range.close.slice(0, 5)}. Arriving by {range.open.slice(0, 5)}, plus a short grace, counts as on time. Change the hours in {settings}.</p>;
}

export function FinancialsScreen() {
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Drawer failed");
      return result.data ?? null;
    },
  });
  const open = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/drawer/open", { body: { opening_balance: opening } });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not open drawer");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["drawer"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const close = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/drawer/close", {
        body: { declared_cash_amount: counted, closing_notes: "End of shift" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not close drawer");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Z reports failed");
      return result.data.items ?? [];
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/financials/z-report/generate", { body: {} });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not generate Z");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["z-reports"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isRoleDenied(drawer.error) && isRoleDenied(reports.error)) return <RoleUnavailableState screen="Till" />;

  const shiftOpen = drawer.data?.status === "OPEN";
  const reportRows = reports.data ?? [];
  const todayReport = reportRows.some((report) => report.business_date === cairoBusinessDate());

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">Till</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">The cash drawer for this shift, and the report you print at the end of the day.</p>
      </div>
      {drawer.isLoading ? <LoadingState label="Loading the till" /> : null}
      {drawer.isError ? <QueryErrorState error={drawer.error} screen="The cash drawer" onRetry={() => void drawer.refetch()} /> : null}
      {reports.isError ? <QueryErrorState error={reports.error} screen="End-of-day reports" onRetry={() => void reports.refetch()} /> : null}
      <section className="grid gap-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Cash drawer</h2>
            <p className="text-sm leading-6 text-muted-foreground">The notes and coins in the till. Start a shift with the cash already in it. End the shift by counting what is left.</p>
          </div>
          <StatusChip tone={shiftOpen ? "ready" : "neutral"}>{shiftOpen ? "Shift open" : "No shift open"}</StatusChip>
        </div>
        {drawer.data ? (
          <p className="text-sm">
            Started with <Money amount={drawer.data.opening_balance} />
            {drawer.data.opened_at ? ` · ${formatCairoDateTime(drawer.data.opened_at)}` : ""}
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Opening cash (EGP)
            <span className="text-sm leading-6 text-muted-foreground">The cash in the drawer when this shift starts.</span>
            <input className={control} inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={shiftOpen || open.isPending} onClick={() => open.mutate()}>
              {open.isPending ? "Starting…" : "Start the shift"}
            </button>
            {shiftOpen ? <span className="text-sm text-muted-foreground">A shift is already open. Count the cash and end it first.</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            Counted cash (EGP)
            <span className="text-sm leading-6 text-muted-foreground">The cash you count when the shift ends.</span>
            <input className={control} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 rounded-xl border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={!shiftOpen || close.isPending} onClick={() => setCloseOpen(true)}>
              End the shift
            </button>
          </label>
        </div>
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">End-of-day report</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">One report for today in Cairo time. It counts paid orders, and a later press refreshes that same report when the figures change. Ending the shift records the cash count and does not fill this report.</p>
          </div>
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? (todayReport ? "Updating…" : "Creating…") : todayReport ? "Update today's report" : "Create end-of-day report"}
          </button>
        </div>
        {reportRows.length === 0 ? <p className="text-sm text-muted-foreground">No end-of-day reports yet.</p> : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">Report</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Day</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Gross sales</th>
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
      <ConfirmDialog open={closeOpen} onOpenChange={setCloseOpen} title="End this shift?" description="This saves the cash you counted and closes the till." confirmLabel="End the shift" onConfirm={() => close.mutate()} />
    </div>
  );
}

export function ZReportScreen({ reportId }: { reportId: string }) {
  const report = useQuery({
    queryKey: ["z", reportId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/z-report/{report_id}", { params: { path: { report_id: reportId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Report failed");
      return result.data;
    },
  });
  if (report.isLoading) return <LoadingState label="Loading report" />;
  if (report.isError) return <ErrorState body={report.error.message} onRetry={() => void report.refetch()} />;
  const data = report.data;
  if (!data) return <ErrorState body="Report missing" onRetry={() => void report.refetch()} />;
  return (
    <article className="grid gap-4">
      <div className="grid gap-1">
        <Link href="/app/financials" className="text-sm text-muted-foreground underline-offset-2 hover:underline print:hidden">Back to the till</Link>
        <h1 className="text-[length:var(--text-28)] font-semibold">End-of-day report</h1>
        <p className="text-sm text-muted-foreground">{data.report_number} · {data.business_date}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">Gross sales</dt>
          <dd className="text-lg font-semibold"><Money amount={data.gross_sales} /></dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">Net sales</dt>
          <dd className="text-lg font-semibold"><Money amount={data.net_sales} /></dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">Tax</dt>
          <dd className="text-lg font-semibold"><Money amount={data.total_tax} /></dd>
        </div>
      </dl>
      <button type="button" className="min-h-11 w-fit rounded-xl border px-4 text-sm print:hidden" onClick={() => window.print()}>Print</button>
    </article>
  );
}

const ATTENDANCE_RANGES = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
] as const;

export function AttendanceScreen() {
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
  const [range, setRange] = useState<(typeof ATTENDANCE_RANGES)[number]["value"]>("daily");
  const hoursBranch = useQuery({
    queryKey: ["branch", branchId],
    enabled: Boolean(branchId) && isAdmin,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branch failed");
      return result.data;
    },
  });
  const status = useQuery({
    queryKey: ["attendance-me"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-status");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Status failed");
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
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Logs failed");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Transactions failed");
      return result.data.records ?? [];
    },
  });
  async function punch(kind: "in" | "out") {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
    }).catch(() => null);
    if (!position) {
      toast.error("Allow location so we can confirm you are at the branch.");
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
      const error = asApiError(result.error, result.response, "Attendance failed");
      toast.error(error.code === "OUT_OF_GEOFENCE" ? "You need to be at the branch to check in." : error.message);
      return;
    }
    toast.success(kind === "in" ? "Checked in" : "Checked out");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Override failed");
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
        <h1 className="text-[length:var(--text-28)] font-semibold">Attendance</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Check in when you arrive at the branch.
          {canReviewStaff ? " The list shows the staff at the branches you look after." : ""}
        </p>
        {isAdmin && !hoursBranch.isLoading ? <TodayHoursNote hours={hoursBranch.data?.opening_hours} branchId={branchId} /> : null}
      </div>
      {status.isError ? (
        <ErrorState body={status.error instanceof Error ? status.error.message : "Status failed"} onRetry={() => void status.refetch()} />
      ) : (
        <p className="text-sm">
          {status.isLoading
            ? "Loading your attendance…"
            : attendanceHeading(status.data?.employee_name, status.data?.attendance?.status)}
          {status.data?.attendance?.check_in ? ` · In ${formatCairoDateTime(status.data.attendance.check_in)}` : ""}
          {status.data?.attendance?.check_out ? ` · Out ${formatCairoDateTime(status.data.attendance.check_out)}` : ""}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="min-h-12 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => void punch("in")}>Check in</button>
        <button type="button" className="min-h-12 rounded-lg border px-4 text-sm" onClick={() => void punch("out")}>Check out</button>
      </div>
      {canReviewStaff ? (
      <>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-medium">Staff attendance</h2>
          <label className="grid gap-1 text-sm">
            Period
            <select className={control} value={range} onChange={(event) => setRange(event.target.value as typeof range)}>
              {ATTENDANCE_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {logs.isLoading ? <p className="text-sm text-muted-foreground">Loading attendance…</p> : null}
        {logs.isError ? <ErrorState body={logs.error instanceof Error ? logs.error.message : "Logs failed"} onRetry={() => void logs.refetch()} /> : null}
        {!logs.isLoading && !logs.isError && watchedBranchIds.length === 0 ? <p className="text-sm text-muted-foreground">Choose a branch to see who has checked in.</p> : null}
        {!logs.isLoading && !logs.isError && watchedBranchIds.length > 0 && (logs.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No one has checked in for this period.</p> : null}
        {(logs.data ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">Person</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Branch</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Day</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Arrived</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Left</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Status</th>
                  {canOverride ? <th scope="col" className="px-4 py-3 text-start font-medium">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).map((log) => (
                  <tr key={log.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-medium">{log.employee_name}</th>
                    <td className="px-4 py-4">{log.branch_name}</td>
                    <td className="px-4 py-4">{log.date}</td>
                    <td className="px-4 py-4">{log.check_in ? formatCairoDateTime(log.check_in) : "—"}</td>
                    <td className="px-4 py-4">{log.check_out ? formatCairoDateTime(log.check_out) : "—"}</td>
                    <td className="px-4 py-4">{attendanceStatusLabel(log.status)}</td>
                    {canOverride ? (
                      <td className="px-4 py-4">
                        <button type="button" className="min-h-11 underline" onClick={() => setLogId(log.id)}>Correct</button>
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
          <h2 className="font-medium">Payments taken</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Every payment recorded at this branch, newest first. A payment that is still waiting to be confirmed stays on the Payments page.</p>
        </div>
        {txns.isLoading ? <p className="text-sm text-muted-foreground">Loading payments…</p> : null}
        {txns.isError ? <QueryErrorState error={txns.error} screen="Payments taken" onRetry={() => void txns.refetch()} /> : null}
        {!txns.isLoading && !txns.isError && (txns.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded yet.</p> : null}
        {(txns.data ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">When</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Method</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(txns.data ?? []).map((txn) => (
                  <tr key={txn.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-medium">{formatCairoDateTime(txn.created_at)}</th>
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
          <ConfirmDialog open={Boolean(logId)} onOpenChange={(open) => !open && setLogId(null)} title="Correct this attendance record?" description="Add a reason. This is stored on the record." confirmLabel="Correct" onConfirm={() => override.mutate()} />
          {logId ? <textarea className="min-h-20 rounded-lg border px-3 py-2" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
        </>
      ) : null}
    </div>
  );
}

const PERIODS: { value: components["schemas"]["TimePeriod"]; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
];

const KPI_LABELS: Record<string, string> = {
  gmv: "Gross sales",
  net_revenue: "Net revenue",
  total_tax: "Tax",
  total_service_fees: "Service fees",
  total_discounts: "Discounts",
  total_refunds: "Refunds",
  total_orders: "Orders",
  paid_orders: "Paid orders",
  cancelled_orders: "Cancelled orders",
  aov: "Average order",
  average_items_per_order: "Items per order",
};

const MONEY_KPIS = new Set(["gmv", "net_revenue", "total_tax", "total_service_fees", "total_discounts", "total_refunds", "aov"]);

function chartAmount(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function AnalyticsScreen({ view, embedded = false, branchId }: { view: "dashboard" | "menu" | "branches"; embedded?: boolean; branchId?: string | null }) {
  const [period, setPeriod] = useState<components["schemas"]["TimePeriod"]>("last_7_days");
  const data = useQuery({
    queryKey: ["analytics", view, period, branchId ?? "all"],
    queryFn: async () => {
      const scoped = branchId ? { period, branch_id: branchId } : { period };
      if (view === "menu") {
        const result = await browserApi.GET("/api/v1/analytics/menu-performance", { params: { query: scoped } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Analytics failed");
        return result.data;
      }
      if (view === "branches") {
        const result = await browserApi.GET("/api/v1/analytics/branches-matrix", { params: { query: { period } } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Analytics failed");
        return result.data;
      }
      const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query: scoped } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Analytics failed");
      return result.data;
    },
  });
  const tabs = [
    { id: "dashboard", href: "/app/analytics", label: "Dashboard" },
    { id: "menu", href: "/app/analytics/menu", label: "Menu" },
    { id: "branches", href: "/app/analytics/branches", label: "Branches" },
  ] as const;

  return (
    <div className="grid gap-4">
      {embedded ? null : (
        <>
          <div className="grid gap-1">
            <h1 className="text-[length:var(--text-28)] font-semibold">Analytics</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Sales for the period you choose.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link key={tab.id} className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm ${tab.id === view ? "bg-primary font-medium text-primary-foreground" : "border bg-card"}`} href={tab.href}>{tab.label}</Link>
            ))}
          </div>
        </>
      )}
      <label className="grid max-w-xs gap-1 text-sm">
        Period
        <select className={control} value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
          {PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {data.isLoading ? <LoadingState label="Loading analytics" /> : null}
      {data.isError ? <ErrorState body={data.error.message} onRetry={() => void data.refetch()} /> : null}
      {data.data && "kpis" in data.data && data.data.kpis && typeof data.data.kpis === "object" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.data.kpis as Record<string, unknown>).map(([key, value]) => (
            <article key={key} className="rounded-2xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">{KPI_LABELS[key] ?? key.replaceAll("_", " ")}</p>
              <p className="text-lg font-semibold tabular-nums">{typeof value === "string" && MONEY_KPIS.has(key) ? formatMoney(value) : String(value ?? "")}</p>
            </article>
          ))}
        </div>
      ) : null}
      {data.data && "top_selling_items" in data.data ? (
        <ItemsBarChart
          title="Top items"
          caption="How many of each item sold. The details show the sales as well."
          rows={data.data.top_selling_items.map((item) => ({
            id: item.item_id,
            label: pickLocale(item.item_name, "en"),
            quantity: item.total_quantity_sold,
            revenue: item.gross_revenue,
          }))}
        />
      ) : null}
      {data.data && "bottom_selling_items" in data.data ? (
        <ItemsBarChart
          title="Slowest items"
          caption="The items that sold the least in this period."
          rows={data.data.bottom_selling_items.map((item) => ({
            id: item.item_id,
            label: pickLocale(item.item_name, "en"),
            quantity: item.total_quantity_sold,
            revenue: item.gross_revenue,
          }))}
        />
      ) : null}
      {data.data && "category_breakdown" in data.data ? (
        <CategoryDonut
          rows={data.data.category_breakdown.map((item) => ({
            id: item.category_id,
            label: pickLocale(item.category_name, "en"),
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
            label: pickLocale(row.branch_name, "en"),
            gmv: chartAmount(row.gmv),
            cash: chartAmount(row.cash_revenue),
            digital: chartAmount(row.digital_revenue),
            gmvText: formatMoney(row.gmv),
            cashText: formatMoney(row.cash_revenue),
            digitalText: formatMoney(row.digital_revenue),
            orders: row.total_paid_orders,
          }))}
        />
      ) : null}
      {!branchId && data.data && "branch_rankings" in data.data && Array.isArray(data.data.branch_rankings) ? (
        <BranchesBarChart
          rows={(data.data.branch_rankings as components["schemas"]["BranchPerformanceRow"][]).map((row) => ({
            id: row.branch_id,
            label: pickLocale(row.branch_name, "en"),
            gmv: chartAmount(row.gmv),
            cash: chartAmount(row.cash_revenue),
            digital: chartAmount(row.digital_revenue),
            gmvText: formatMoney(row.gmv),
            cashText: formatMoney(row.cash_revenue),
            digitalText: formatMoney(row.digital_revenue),
            orders: row.total_paid_orders,
          }))}
        />
      ) : null}
    </div>
  );
}

function auditRoleLabel(role: string | null | undefined): string {
  if (!role || role === "ANONYMOUS") return "Not signed in";
  return isUserRole(role) ? roleLabel(role) : role;
}

export function AuditScreen() {
  const [action, setAction] = useState("");
  const [role, setRole] = useState("");
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/audit/logs", {
        params: { query: { limit: 50 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Audit failed");
      return result.data;
    },
  });
  const actionNeedle = action.trim().toLowerCase();
  const roleNeedle = role.trim().toLowerCase();
  const rows = (logs.data?.items ?? []).filter((item) => {
    const actionMatches = !actionNeedle || auditActionLabel(item.action).toLowerCase().includes(actionNeedle);
    const roleText = `${auditRoleLabel(item.actor_role)} ${item.actor_role ?? ""}`.toLowerCase();
    const roleMatches = !roleNeedle || roleText.includes(roleNeedle);
    return actionMatches && roleMatches;
  });
  return (
    <div className="grid gap-3">
      <h1 className="text-[length:var(--text-28)] font-semibold">Audit</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          What happened
          <input className={control} value={action} onChange={(event) => setAction(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Role
          <input className={control} placeholder="Cashier, Super admin" value={role} onChange={(event) => setRole(event.target.value)} />
        </label>
      </div>
      {logs.isLoading ? <LoadingState label="Loading audit" /> : null}
      {logs.isError ? <ErrorState body={logs.error.message} onRetry={() => void logs.refetch()} /> : null}
      {!logs.isLoading && !logs.isError && rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing matches.</p> : null}
      <ul className="grid gap-2 lg:hidden">
        {rows.map((item) => (
          <li key={item.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{auditActionLabel(item.action)}</p>
            <p>{auditRoleLabel(item.actor_role)} · {formatCairoDateTime(item.created_at)} · {auditStatusLabel(item.status)}</p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead>
          <tr className="text-start">
            <th className="p-2">When</th>
            <th className="p-2">What happened</th>
            <th className="p-2">Role</th>
            <th className="p-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{formatCairoDateTime(item.created_at)}</td>
              <td className="p-2">{auditActionLabel(item.action)}</td>
              <td className="p-2">{auditRoleLabel(item.actor_role)}</td>
              <td className="p-2">{auditStatusLabel(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
