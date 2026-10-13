"use client";

import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage } from "./access";
import { InventoryFrame } from "./chrome";
import { formatQty } from "./qty";

export function JobsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, "jobs"));
  const branchId = useScope((state) => state.branchId);
  const jobs = useQuery({
    queryKey: ["inventory", "jobs", "FAILED", branchId],
    enabled: allowed && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/deduction-jobs", {
        params: { query: { status: "FAILED", branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  return (
    <InventoryFrame page="jobs">
      <PageHeader title={t.jobs.title} detail={t.jobs.detail} />
      {jobs.isLoading ? <LoadingState label={t.loading} /> : null}
      {jobs.isError ? <QueryErrorState error={jobs.error} screen={t.tabs.jobs} onRetry={() => void jobs.refetch()} /> : null}
      {jobs.data && jobs.data.length === 0 ? <EmptyState title={t.jobs.empty} body={t.jobs.detail} /> : null}
      {jobs.data && jobs.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.jobs.order, t.jobs.kind, t.jobs.attempts, t.jobs.error, t.jobs.next].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.data.map((job) => (
                <tr key={job.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{job.order_id}</td>
                  <td className="px-3 py-2">{job.kind}</td>
                  <td className="px-3 py-2 tabular-nums">{formatQty(job.attempts, locale)}</td>
                  <td className="px-3 py-2">{job.last_error ?? ""}</td>
                  <td className="px-3 py-2">{formatCairoDateTime(job.next_attempt_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryFrame>
  );
}
