"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { latestTimestamp, LiveCount } from "@/components/ops/live-fact";
import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymentsCopy } from "@/lib/i18n/staff/payments";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

function paymentTone(status: string): "available" | "browsing" | "ordered" | "soldout" | "neutral" {
  if (status === "COMPLETED") return "available";
  if (status === "FAILED" || status === "REFUNDED") return "soldout";
  if (status === "PENDING_CASHIER_VERIFICATION") return "browsing";
  if (status === "PENDING") return "ordered";
  return "neutral";
}

export function PaymentsScreen() {
  const t = useStaffSection(paymentsCopy);
  const { locale } = useLocale();
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["payments-pending", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/payments/branch/pending");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });

  const verify = useMutation({
    mutationFn: async (paymentId: string) => {
      const result = await browserApi.POST("/api/v1/payments/offline/{payment_id}/verify", {
        params: { path: { payment_id: paymentId } },
        body: { notes: "Verified at the counter" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.verifyFailed, locale);
    },
    onSuccess: (_data, paymentId) => {
      const row = (pending.data ?? []).find((payment) => payment.id === paymentId);
      ignoreOwnChange(paymentId, "COMPLETED");
      if (row) ignoreOwnChange(row.order_id, "PAID");
      toast.success(t.verified);
      void queryClient.invalidateQueries({ queryKey: ["payments-pending"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (pending.isLoading) return <LoadingState label={t.loading} />;
  if (pending.isError) return <QueryErrorState error={pending.error} screen={t.screen} onRetry={() => void pending.refetch()} />;

  const rows = pending.data ?? [];
  const lastPayment = latestTimestamp(rows.map((payment) => payment.created_at));

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.hint}</p>
        {rows.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            <LiveCount value={rows.length} /> {t.waiting}
            {lastPayment ? <> · {fill(t.lastAt, { time: formatCairoDateTime(lastPayment, locale) })}</> : null}
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="px-4 py-3 text-start text-sm text-muted-foreground">{t.caption}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.order}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.method}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.status}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.amount}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => {
                const confirming = verify.isPending && verify.variables === payment.id;
                return (
                  <tr key={payment.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-semibold tabular-nums">
                      {payment.pickup_number != null ? fill(t.pickup, { number: payment.pickup_number }) : t.table}
                    </th>
                    <td className="px-4 py-4">{paymentMethodLabel(payment.payment_method)}</td>
                    <td className="px-4 py-4">
                      <StatusChip tone={paymentTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusChip>
                    </td>
                    <td className="px-4 py-4 font-medium"><Money amount={payment.amount} currency={payment.currency} /></td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                        disabled={confirming}
                        onClick={() => verify.mutate(payment.id)}
                      >
                        {confirming ? t.confirming : t.confirm}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
