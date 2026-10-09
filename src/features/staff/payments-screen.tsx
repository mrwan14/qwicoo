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
import { getStaffOrder } from "@/lib/api/staff-order";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymentsCopy } from "@/lib/i18n/staff/payments";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { paymentPlaceLabel } from "@/features/staff/place-labels";
import { useScope } from "@/stores/scope";

function paymentTone(status: string): "available" | "browsing" | "ordered" | "soldout" | "neutral" {
  if (status === "COMPLETED") return "available";
  if (status === "FAILED" || status === "REFUNDED") return "soldout";
  if (status === "PENDING_CASHIER_VERIFICATION") return "browsing";
  if (status === "PENDING") return "ordered";
  return "neutral";
}

/** paymentPlaceLabel decides the place; this shows it in the staff language. */
function placeLabel(payment: Parameters<typeof paymentPlaceLabel>[0], copy: typeof paymentsCopy.en): string {
  if (payment.pickup_number != null) return fill(copy.pickup, { number: payment.pickup_number });
  const label = paymentPlaceLabel(payment);
  if (label === "Drive-thru") return copy.driveThru;
  if (label === "Takeaway") return copy.takeaway;
  if (label.startsWith("Table ")) return fill(copy.tableNumber, { number: label.slice("Table ".length) });
  return copy.table;
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

  const rows = pending.data ?? [];
  const tableOrders = rows.filter((payment) => payment.pickup_number == null && paymentPlaceLabel(payment) === "Table");
  const tables = useQuery({
    queryKey: ["payment-tables", branchId, tableOrders.map((payment) => payment.order_id).join(",")],
    enabled: tableOrders.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(tableOrders.map(async (payment) => {
        try {
          const order = await getStaffOrder(payment.order_id);
          return [payment.order_id, order.display_number?.trim() || ""] as const;
        } catch {
          return [payment.order_id, ""] as const;
        }
      }));
      return Object.fromEntries(entries);
    },
  });

  if (pending.isLoading) return <LoadingState label={t.loading} />;
  if (pending.isError) return <QueryErrorState error={pending.error} screen={t.screen} onRetry={() => void pending.refetch()} />;

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
                      {placeLabel({ ...payment, display_number: tables.data?.[payment.order_id] }, t)}
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
