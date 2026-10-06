"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { BranchesBarChart, CategoryDonut, ItemsBarChart } from "@/features/staff/analytics-charts";
import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState, QueryErrorState, RoleUnavailableState } from "@/components/ops/states";
import { asApiError, isRoleDenied } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { formatCairoDateTime } from "@/lib/format/time";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

function attendanceStatusLabel(status: string | null | undefined): string {
  const value = status?.trim();
  if (!value || value.toLowerCase() === "unknown") return "Not checked in";
  return value;
}

function attendanceHeading(name: string | null | undefined, status: string | null | undefined): string {
  const label = attendanceStatusLabel(status);
  const who = name?.trim();
  return who ? `${who} · ${label}` : label;
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

  if (isRoleDenied(drawer.error) && isRoleDenied(reports.error)) return <RoleUnavailableState screen="Financials" />;

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Financials</h1>
      {drawer.isLoading ? <LoadingState label="Loading drawer" /> : null}
      {drawer.isError ? <QueryErrorState error={drawer.error} screen="The cash drawer" onRetry={() => void drawer.refetch()} /> : null}
      {reports.isError ? <QueryErrorState error={reports.error} screen="Z reports" onRetry={() => void reports.refetch()} /> : null}
      <p className="text-sm">Drawer {drawer.data?.status ?? "none"}</p>
      <div className="flex flex-wrap gap-2">
        <input className={control} value={opening} onChange={(event) => setOpening(event.target.value)} />
        <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => open.mutate()}>Open drawer</button>
        <input className={control} value={counted} onChange={(event) => setCounted(event.target.value)} />
        <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setCloseOpen(true)}>Close drawer</button>
      </div>
      <button type="button" className="min-h-11 w-fit rounded-lg border px-4 text-sm" onClick={() => generate.mutate()}>Generate Z report</button>
      <ul className="grid gap-2">
        {(reports.data ?? []).map((report) => (
          <li key={report.id}>
            <Link className="inline-flex min-h-11 items-center underline" href={`/app/financials/z/${report.id}`}>{report.report_number}</Link>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={closeOpen} onOpenChange={setCloseOpen} title="Close the drawer?" description="Counted cash is stored with the shift." confirmLabel="Close drawer" destructive onConfirm={() => close.mutate()} />
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
    <article className="grid gap-2">
      <h1 className="text-[length:var(--text-28)] font-semibold">{data.report_number}</h1>
      <p>Gross <Money amount={data.gross_sales} /></p>
      <p>Net <Money amount={data.net_sales} /></p>
      <p>Tax <Money amount={data.total_tax} /></p>
      <button type="button" className="min-h-11 w-fit rounded-lg border px-4 text-sm print:hidden" onClick={() => window.print()}>Print</button>
    </article>
  );
}

export function AttendanceScreen() {
  const branchId = useScope((state) => state.branchId);
  const [reason, setReason] = useState("");
  const [logId, setLogId] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["attendance-me"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-status");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Status failed");
      return result.data;
    },
  });
  const logs = useQuery({
    queryKey: ["attendance-logs", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-logs", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Logs failed");
      return result.data.records ?? [];
    },
  });
  const txns = useQuery({
    queryKey: ["cashier-txns", branchId],
    enabled: Boolean(branchId),
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
    const body: components["schemas"]["CheckInRequest"] = {
      latitude: position?.coords.latitude ?? 0,
      longitude: position?.coords.longitude ?? 0,
    };
    const result = kind === "in"
      ? await browserApi.POST("/api/v1/attendance/check-in", { body })
      : await browserApi.POST("/api/v1/attendance/check-out", { body });
    if (!result.response.ok) toast.error(asApiError(result.error, result.response, "Attendance failed").message);
    else {
      toast.success(kind === "in" ? "Checked in" : "Checked out");
      void status.refetch();
    }
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
      <h1 className="text-[length:var(--text-28)] font-semibold">Attendance</h1>
      {status.isError ? (
        <ErrorState body={status.error instanceof Error ? status.error.message : "Status failed"} onRetry={() => void status.refetch()} />
      ) : (
        <p className="text-sm">
          {status.isLoading
            ? "Loading your attendance…"
            : attendanceHeading(status.data?.employee_name, status.data?.attendance?.status)}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="min-h-12 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => void punch("in")}>Check in</button>
        <button type="button" className="min-h-12 rounded-lg border px-4 text-sm" onClick={() => void punch("out")}>Check out</button>
      </div>
      {logs.isError ? <ErrorState body={logs.error instanceof Error ? logs.error.message : "Logs failed"} onRetry={() => void logs.refetch()} /> : null}
      <ul className="grid gap-2">
        {(logs.data ?? []).map((log) => (
          <li key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span>{log.employee_name} · {attendanceStatusLabel(log.status)}</span>
            <button type="button" className="min-h-11 underline" onClick={() => setLogId(log.id)}>Override</button>
          </li>
        ))}
      </ul>
      <section className="grid gap-2">
        <h2 className="font-medium">Cashier transactions</h2>
        <p className="text-sm text-muted-foreground">Transactions are immutable. Edit and delete are not available.</p>
        {(txns.data ?? []).length === 0 ? <p className="text-sm">No transactions.</p> : null}
        <ul className="grid gap-2">
          {(txns.data ?? []).map((txn) => (
            <li key={txn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{txn.payment_method} · {txn.status}</span>
              <Money amount={String(txn.amount)} currency={txn.currency} />
              <span className="text-muted-foreground">{txn.created_at}</span>
            </li>
          ))}
        </ul>
      </section>
      <ConfirmDialog open={Boolean(logId)} onOpenChange={(open) => !open && setLogId(null)} title="Override this attendance record?" description="Add a reason. This is stored on the log." confirmLabel="Override" onConfirm={() => override.mutate()} />
      <textarea className="min-h-20 rounded-lg border px-3 py-2" placeholder="Override reason" value={reason} onChange={(event) => setReason(event.target.value)} />
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

export function AnalyticsScreen({ view }: { view: "dashboard" | "menu" | "branches" }) {
  const [period, setPeriod] = useState<components["schemas"]["TimePeriod"]>("last_7_days");
  const data = useQuery({
    queryKey: ["analytics", view, period],
    queryFn: async () => {
      if (view === "menu") {
        const result = await browserApi.GET("/api/v1/analytics/menu-performance", { params: { query: { period } } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Analytics failed");
        return result.data;
      }
      if (view === "branches") {
        const result = await browserApi.GET("/api/v1/analytics/branches-matrix", { params: { query: { period } } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Analytics failed");
        return result.data;
      }
      const result = await browserApi.GET("/api/v1/analytics/dashboard", { params: { query: { period } } });
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
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">Analytics</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Sales for the period you choose.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link key={tab.id} className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm ${tab.id === view ? "bg-primary font-medium text-primary-foreground" : "border bg-card"}`} href={tab.href}>{tab.label}</Link>
        ))}
      </div>
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
      {data.data && "branch_rankings" in data.data && Array.isArray(data.data.branch_rankings) ? (
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

export function AuditScreen() {
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const logs = useQuery({
    queryKey: ["audit", action, resource],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/audit/logs", {
        params: { query: { action: action || undefined, resource_type: resource || undefined, limit: 50 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Audit failed");
      return result.data;
    },
  });
  return (
    <div className="grid gap-3">
      <h1 className="text-[length:var(--text-28)] font-semibold">Audit</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={control} placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
        <input className={control} placeholder="Resource type" value={resource} onChange={(event) => setResource(event.target.value)} />
      </div>
      {logs.isLoading ? <LoadingState label="Loading audit" /> : null}
      {logs.isError ? <ErrorState body={logs.error.message} onRetry={() => void logs.refetch()} /> : null}
      <ul className="grid gap-2 lg:hidden">
        {(logs.data?.items ?? []).map((item) => (
          <li key={item.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{item.action}</p>
            <p>{item.actor_role} · {formatCairoDateTime(item.created_at)}</p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead>
          <tr className="text-start">
            <th className="p-2">When</th>
            <th className="p-2">Action</th>
            <th className="p-2">Role</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(logs.data?.items ?? []).map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{formatCairoDateTime(item.created_at)}</td>
              <td className="p-2">{item.action}</td>
              <td className="p-2">{item.actor_role}</td>
              <td className="p-2">{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
