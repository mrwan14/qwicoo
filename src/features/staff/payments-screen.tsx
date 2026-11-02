"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { latestTimestamp, LiveCount } from "@/components/ops/live-fact";
import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { formatAmount } from "@/components/ops/kit/money";
import { QueryErrorState } from "@/components/ops/states";
import { pendingPaymentsQuery } from "@/features/staff/orders/queries";
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

function paymentTone(status: string): Tone {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "REFUNDED") return "danger";
  if (status === "PENDING_CASHIER_VERIFICATION") return "warning";
  if (status === "PENDING") return "info";
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
    ...pendingPaymentsQuery(branchId, t.loadFailed, locale),
    refetchInterval: pollUnlessRoleDenied(interval),
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

  if (pending.isError) return <QueryErrorState error={pending.error} screen={t.screen} onRetry={() => void pending.refetch()} />;

  const lastPayment = latestTimestamp(rows.map((payment) => payment.created_at));
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "order",
      header: t.order,
      strong: true,
      cell: (payment) => placeLabel({ ...payment, display_number: tables.data?.[payment.order_id] }, t),
    },
    { key: "method", header: t.method, cell: (payment) => paymentMethodLabel(payment.payment_method, locale) },
    {
      key: "status",
      header: t.status,
      cell: (payment) => <Badge tone={paymentTone(payment.status)}>{paymentStatusLabel(payment.status, locale)}</Badge>,
    },
    { key: "amount", header: t.amount, align: "end", cell: (payment) => formatAmount(payment.amount, payment.currency, locale) },
    {
      key: "action",
      header: <span className="sr-only">{t.action}</span>,
      align: "end",
      width: 140,
      cell: (payment) => {
        const confirming = verify.isPending && verify.variables === payment.id;
        return (
          <Button size="sm" disabled={confirming} onClick={() => verify.mutate(payment.id)}>
            {confirming ? t.confirming : t.confirm}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3">
      {rows.length > 0 ? (
        <p className="text-sm text-ink-secondary">
          <LiveCount value={rows.length} /> {t.waiting}
          {lastPayment ? <> · {fill(t.lastAt, { time: formatCairoDateTime(lastPayment, locale) })}</> : null}
        </p>
      ) : null}
      <DataTable
        caption={t.caption}
        columns={columns}
        rows={rows}
        loading={pending.isLoading}
        rowKey={(payment) => payment.id}
        empty={t.empty}
      />
    </div>
  );
}
