"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { BellRing, Check, Hand, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { seatedShort } from "@/features/staff/floor/seated";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { requestsCopy } from "@/lib/i18n/staff/requests";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

type Request = components["schemas"]["ServiceRequestResponse"];

/** The API escalates calls left pending longer than this (its default threshold). */
const OVERDUE_SECONDS = 180;

function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [every]);
  return now;
}

/** `embedded` shows a card heading instead of the page title (Orders → Tables). */
export function RequestsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useStaffSection(requestsCopy);
  const { locale } = useLocale();
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const now = useNow();
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

  const minutesWaiting = (request: Request) => Math.max(0, Math.floor((now - Date.parse(request.created_at)) / 60000));
  const isOverdue = (request: Request) => request.status === "PENDING" && (now - Date.parse(request.created_at)) / 1000 > OVERDUE_SECONDS;
  // Calls nobody has taken first, oldest first: the guest who has waited longest is next.
  const calls = [...(queue.data ?? [])].sort(
    (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const overdue = calls.filter((request) => isOverdue(request) && !request.is_escalated).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          {embedded ? <h2 className="text-sm font-semibold text-ink">{t.title}</h2> : <h1 className="font-title text-[28px] font-medium text-ink sm:text-[32px]">{t.title}</h1>}
          {embedded ? null : <p className="max-w-xl text-sm text-ink-secondary">{t.intro}</p>}
        </div>
        {overdue > 0 ? (
          <button type="button" className={buttonClass({ variant: "secondary", size: "sm" })} disabled={escalate.isPending} onClick={() => escalate.mutate()}>
            <Siren aria-hidden />
            {fill(t.escalate, { count: overdue })}
          </button>
        ) : null}
      </div>
      {calls.length === 0 ? (
        <EmptyState icon={BellRing} title={t.empty} body={t.emptyBody} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {calls.map((request) => {
            const late = isOverdue(request);
            const minutes = minutesWaiting(request);
            const taken = request.status === "ACKNOWLEDGED";
            return (
              <li
                key={request.id}
                className={cn(
                  "grid content-between gap-3 rounded-staff border bg-canvas p-4 text-ink",
                  late ? "border-warning/60 bg-warning-bg/40" : taken ? "border-border" : "border-ink/25",
                )}
              >
                <div className="grid gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xl font-semibold">
                      {request.table_number ? fill(t.tableNumber, { number: request.table_number }) : t.table}
                    </p>
                    <span className={cn("shrink-0 pt-1 text-[13px] tabular-nums", late ? "font-semibold text-warning" : "text-ink-secondary")}>
                      {minutes < 1 ? t.justNow : fill(t.waiting, { time: seatedShort(minutes, locale) })}
                    </span>
                  </div>
                  <p className="text-[15px] font-medium">{t.type[request.request_type]}</p>
                  {request.note ? <p className="text-sm text-ink-secondary">“{request.note}”</p> : null}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <Badge tone={taken ? "info" : "warning"}>{t.status[request.status]}</Badge>
                    {late ? <Badge tone="danger">{t.overdue}</Badge> : null}
                    {request.is_escalated ? <Badge>{t.escalatedBadge}</Badge> : null}
                  </div>
                </div>
                {/* The next step is one big button within thumb reach; the rest stay small. */}
                <div className="grid gap-2">
                  <Button
                    size="touch"
                    className="w-full"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: request.id, status: taken ? "COMPLETED" : "ACKNOWLEDGED" })}
                  >
                    {taken ? <Check aria-hidden /> : <Hand aria-hidden />}
                    {taken ? t.action.COMPLETED : t.action.ACKNOWLEDGED}
                  </Button>
                  <div className="flex justify-between gap-2">
                    {!taken ? (
                      <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} disabled={update.isPending} onClick={() => update.mutate({ id: request.id, status: "COMPLETED" })}>
                        {t.action.COMPLETED}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} disabled={update.isPending} onClick={() => update.mutate({ id: request.id, status: "DISMISSED" })}>
                      {t.action.DISMISSED}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
