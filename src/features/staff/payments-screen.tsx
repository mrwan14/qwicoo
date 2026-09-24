"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { usePollingInterval } from "@/hooks/use-page-visible";

export function PaymentsScreen() {
  const interval = usePollingInterval(7000);
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["payments-pending"],
    refetchInterval: interval,
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
    onSuccess: () => {
      toast.success("Payment verified");
      void queryClient.invalidateQueries({ queryKey: ["payments-pending"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (pending.isLoading) return <LoadingState label="Loading payments" />;
  if (pending.isError) return <ErrorState body={pending.error.message} onRetry={() => void pending.refetch()} />;

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Payments</h1>
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Card webhooks are received by the server. This app never calls the payment webhook URL.
      </p>
      {(pending.data ?? []).length === 0 ? <p className="text-sm">No payments are waiting.</p> : null}
      <ul className="grid gap-3">
        {(pending.data ?? []).map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="font-medium">{payment.payment_method}</p>
              <p className="text-sm text-muted-foreground">{payment.status}</p>
            </div>
            <Money amount={payment.amount} currency={payment.currency} />
            <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => verify.mutate(payment.id)}>
              Verify
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
