"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const STATUSES: components["schemas"]["ServiceRequestStatus"][] = ["ACKNOWLEDGED", "COMPLETED", "DISMISSED"];

export function RequestsScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: ["service-queue", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/service-requests/active");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Queue failed");
      return result.data;
    },
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; status: components["schemas"]["ServiceRequestStatus"] }) => {
      const result = await browserApi.PATCH("/api/v1/service-requests/{request_id}/status", {
        params: { path: { request_id: input.id } },
        body: { status: input.status },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Update failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["service-queue"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const escalate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/service-requests/sla/escalate-overdue");
      if (!result.response.ok) throw asApiError(result.error, result.response, "Escalate failed");
      return result.data;
    },
    onSuccess: (data) => toast.success(`Escalated ${data?.escalated_count ?? 0}`),
    onError: (error: Error) => toast.error(error.message),
  });

  if (queue.isLoading) return <LoadingState label="Loading requests" />;
  if (queue.isError) return <QueryErrorState error={queue.error} screen="Requests" onRetry={() => void queue.refetch()} />;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[length:var(--text-28)] font-semibold">Requests</h1>
        <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => escalate.mutate()}>
          Escalate overdue
        </button>
      </div>
      {(queue.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No open requests.</p> : null}
      <ul className="grid gap-3">
        {(queue.data ?? []).map((request) => (
          <li key={request.id} className="grid gap-2 rounded-xl border p-3">
            <p className="font-medium">
              {request.table_number ?? "Table"} · {request.request_type}
            </p>
            <p className="text-sm">{request.status}{request.note ? ` · ${request.note}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <button key={status} type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => update.mutate({ id: request.id, status })}>
                  {status}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
