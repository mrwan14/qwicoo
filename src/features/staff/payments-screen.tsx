"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { Money } from "@/components/ops/money";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

export function PaymentsScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["payments-pending", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/payments/branch/pending");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Payments failed");
      return result.data;
    },
  });

  const verify = useMutation({
    mutationFn: async (paymentId: string) => {
      const result = await browserApi.POST("/api/v1/payments/offline/{payment_id}/verify", {
        params: { path: { payment_id: paymentId } },
        body: { notes: "Verified at the counter" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Verify failed");
    },
    onSuccess: (_data, paymentId) => {
      const row = (pending.data ?? []).find((payment) => payment.id === paymentId);
      ignoreOwnChange(paymentId, "COMPLETED");
      if (row) ignoreOwnChange(row.order_id, "PAID");
      toast.success("Payment verified");
      void queryClient.invalidateQueries({ queryKey: ["payments-pending"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (pending.isLoading) return <LoadingState label="Loading payments" />;
  if (pending.isError) return <QueryErrorState error={pending.error} screen="Payments" onRetry={() => void pending.refetch()} />;

  const rows = pending.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">Payments</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Cash and card-terminal payments waiting for you to confirm the money was taken.</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No payments are waiting.</p> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="px-4 py-3 text-start text-sm text-muted-foreground">Confirm a row after you have taken the money.</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-start font-medium">Order</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Method</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Amount</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => {
                const confirming = verify.isPending && verify.variables === payment.id;
                return (
                  <tr key={payment.id} className="border-b align-middle last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-start font-semibold tabular-nums">
                      {payment.pickup_number != null ? `Pickup ${payment.pickup_number}` : "Table"}
                    </th>
                    <td className="px-4 py-4">{paymentMethodLabel(payment.payment_method)}</td>
                    <td className="px-4 py-4">{paymentStatusLabel(payment.status)}</td>
                    <td className="px-4 py-4 font-medium"><Money amount={payment.amount} currency={payment.currency} /></td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                        disabled={confirming}
                        onClick={() => verify.mutate(payment.id)}
                      >
                        {confirming ? "Confirming…" : "Confirm payment"}
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
