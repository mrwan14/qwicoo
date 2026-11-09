"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenTitle } from "@/components/ops/page-header";
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
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { analyticsCopy } from "@/lib/i18n/staff/analytics";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { components } from "@/lib/api/schema";
import { drawerCloseFigures } from "@/features/staff/till";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-staff border px-3 text-sm";
const square = "h-11 w-full border px-3 text-sm";

export function FinancialsScreen() {
  const t = useStaffSection(analyticsCopy).till;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const branchId = useScope((state) => state.branchId);
  const [opening, setOpening] = useState("0.00");
  const [counted, setCounted] = useState("0.00");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closedShift, setClosedShift] = useState<components["schemas"]["CashDrawerSessionResponse"] | null>(null);
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.closeFailed);
      return result.data;
    },
    onSuccess: (session) => {
      setCloseOpen(false);
      setClosedShift(session);
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
    mutationFn: async (drawerSessionId: string) => {
      const result = await browserApi.POST("/api/v1/financials/z-report/generate", {
        body: { drawer_session_id: drawerSessionId },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.generateFailed);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["z-reports"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isRoleDenied(drawer.error) && isRoleDenied(reports.error)) return <RoleUnavailableState screen={t.screen} />;

  const shiftOpen = drawer.data?.status === "OPEN";
  const reportRows = reports.data ?? [];
  const closedFigures = drawerCloseFigures(closedShift);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <ScreenTitle>{t.title}</ScreenTitle>
        <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{t.intro}</p>
      </div>
      {drawer.isLoading ? <LoadingState label={t.loading} /> : null}
      {drawer.isError ? <QueryErrorState error={drawer.error} screen={t.drawerScreen} onRetry={() => void drawer.refetch()} /> : null}
      {reports.isError ? <QueryErrorState error={reports.error} screen={t.reportsScreen} onRetry={() => void reports.refetch()} /> : null}
      <section className="grid gap-4 border bg-canvas p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">{t.drawerTitle}</h2>
            <p className="text-sm leading-6 text-ink-secondary">{t.drawerHint}</p>
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
            <span className="text-sm leading-6 text-ink-secondary">{t.openingHint}</span>
            <input className={square} inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={shiftOpen || open.isPending} onClick={() => open.mutate()}>
              {open.isPending ? t.starting : t.startShift}
            </button>
            {shiftOpen ? <span className="text-sm text-ink-secondary">{t.shiftAlready}</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            {t.counted}
            <span className="text-sm leading-6 text-ink-secondary">{t.countedHint}</span>
            <input className={square} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} />
            <button type="button" className="mt-2 min-h-11 border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={!shiftOpen || close.isPending} onClick={() => setCloseOpen(true)}>
              {t.endShift}
            </button>
          </label>
        </div>
        {closedFigures ? (
          <dl className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-secondary">{t.calculated}</dt>
              <dd className="font-semibold tabular-nums">{closedFigures.calculated ? <Money amount={closedFigures.calculated} /> : "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-secondary">{t.variance}</dt>
              <dd className="font-semibold tabular-nums">{closedFigures.variance ? <Money amount={closedFigures.variance} /> : "—"}</dd>
            </div>
          </dl>
        ) : null}
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">{t.reportTitle}</h2>
            <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{t.reportHint}</p>
          </div>
          {closedShift?.status === "CLOSED" ? (
            <button type="button" className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" disabled={generate.isPending} onClick={() => generate.mutate(closedShift.id)}>
              {generate.isPending ? t.creating : t.createForShift}
            </button>
          ) : null}
        </div>
        {reportRows.length === 0 ? <p className="text-sm text-ink-secondary">{t.noReports}</p> : (
          <div className="overflow-x-auto border bg-canvas">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-ink-secondary">
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.report}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.day}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.period}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.drawer}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t.grossSales}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((report) => (
                  <tr key={report.id} className="border-b last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-start font-medium">
                      <Link className="underline-offset-2 hover:underline" href={`/app/reports/till/z/${report.id}`}>{report.report_number}</Link>
                    </th>
                    <td className="px-4 py-3 tabular-nums">{report.business_date}</td>
                    <td className="px-4 py-3 text-ink-secondary">{formatCairoDateTime(report.period_start, locale)} – {formatCairoDateTime(report.period_end, locale)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{report.drawer_session_id ? report.drawer_session_id.slice(0, 8) : "—"}</td>
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
    { id: "dashboard", href: "/app/reports/sales", label: t.tabs.dashboard },
    { id: "menu", href: "/app/reports/menu", label: t.tabs.menu },
    { id: "branches", href: "/app/reports/branches", label: t.tabs.branches },
  ] as const;

  const orders = view === "dashboard" ? dashboardOrderCount(data.data) : null;

  return (
    <div className="grid gap-4">
      {embedded && orders != null ? (
        <p className="text-sm text-ink-secondary">
          <LiveCount value={orders} /> {orders === 1 ? t.oneOrder : t.orders}
        </p>
      ) : null}
      {embedded ? null : (
        <>
          <div className="grid gap-1">
            <ScreenTitle>{t.title}</ScreenTitle>
            <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{t.intro}</p>
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
            <article key={key} className="bg-canvas p-4">
              <p className="text-sm text-ink-secondary">{key in t.kpis ? t.kpis[key as keyof typeof t.kpis] : key.replaceAll("_", " ")}</p>
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
      <ScreenTitle>{t.title}</ScreenTitle>
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
      {!logs.isLoading && !logs.isError && rows.length === 0 ? <p className="text-sm text-ink-secondary">{t.empty}</p> : null}
      <ul className="grid gap-2 lg:hidden">
        {rows.map((item) => (
          <li key={item.id} className="rounded-staff border p-3 text-sm">
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
