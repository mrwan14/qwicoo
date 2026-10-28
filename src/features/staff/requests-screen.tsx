"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { buttonClass } from "@/components/ops/kit/button";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { requestsCopy } from "@/lib/i18n/staff/requests";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const STATUSES = ["ACKNOWLEDGED", "COMPLETED", "DISMISSED"] as const;

/** `embedded` shows a card heading instead of the page title (Orders → Tables). */
export function RequestsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useStaffSection(requestsCopy);
  const { locale } = useLocale();
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: ["service-queue", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/service-requests/active");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.queueFailed, locale);
      return result.data;
    },
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; status: components["schemas"]["ServiceRequestStatus"] }) => {
      const result = await browserApi.PATCH("/api/v1/service-requests/{request_id}/status", {
        params: { path: { request_id: input.id } },
        body: { status: input.status },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.updateFailed, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["service-queue"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const escalate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/service-requests/sla/escalate-overdue");
      if (!result.response.ok) throw asApiError(result.error, result.response, t.escalateFailed, locale);
      return result.data;
    },
    onSuccess: (data) => {
      const count = Number(data?.escalated_count ?? 0);
      toast.success(fill(t.escalated, { count: Number.isFinite(count) ? count : 0 }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (queue.isLoading) return <LoadingState label={t.loading} />;
  if (queue.isError) return <QueryErrorState error={queue.error} screen={t.screen} onRetry={() => void queue.refetch()} />;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        {embedded ? <h2 className="text-sm font-semibold text-ink">{t.title}</h2> : <h1 className="font-title text-[28px] font-medium text-ink sm:text-[32px]">{t.title}</h1>}
        <button type="button" className={buttonClass({ variant: "secondary", size: "sm" })} onClick={() => escalate.mutate()}>
          {t.escalate}
        </button>
      </div>
      {(queue.data ?? []).length === 0 ? <p className="text-sm text-ink-secondary">{t.empty}</p> : null}
      <ul className="grid gap-3">
        {(queue.data ?? []).map((request) => (
          <li key={request.id} className="grid gap-2 rounded-staff border border-border bg-info-bg/40 p-3 text-ink">
            <p className="font-medium">
              {request.table_number ? fill(t.tableNumber, { number: request.table_number }) : t.table} · {t.type[request.request_type]}
            </p>
            <p className="text-sm">{t.status[request.status]}{request.note ? ` · ${request.note}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <button key={status} type="button" className={buttonClass({ variant: "secondary", size: "field" })} onClick={() => update.mutate({ id: request.id, status })}>
                  {t.action[status]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
