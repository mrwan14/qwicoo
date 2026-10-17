"use client";

import { useQuery } from "@tanstack/react-query";

import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel } from "@/lib/status-labels";

export function OrderRefunds({ orderId }: { orderId: string }) {
  const t = useStaffSection(ordersCopy);
  const { locale } = useLocale();
  const refunds = useQuery({
    queryKey: ["order-refunds", orderId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders/{order_id}/refunds", {
        params: { path: { order_id: orderId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.refundsFailed, locale);
      return result.data;
    },
  });

  return (
    <section className="grid gap-2 border p-3">
      <h2 className="text-sm font-medium">{t.refunds}</h2>
      {refunds.isLoading ? <LoadingState label={t.refundsLoading} /> : null}
      {refunds.isError ? <p className="text-sm text-destructive">{refunds.error.message}</p> : null}
      {refunds.data && refunds.data.length === 0 ? <p className="text-sm text-muted-foreground">{t.noRefunds}</p> : null}
      {refunds.data && refunds.data.length > 0 ? (
        <ul className="grid gap-2 text-sm">
          {refunds.data.map((row) => (
            <li key={row.id} className="grid gap-1 border-b pb-2 last:border-b-0">
              <p className="font-medium tabular-nums"><Money amount={row.amount} /> · {paymentMethodLabel(row.method, locale)}</p>
              <p>{row.reason?.trim() || "—"}</p>
              <p className="text-muted-foreground">
                {row.actor_type}{row.actor_id ? ` · ${row.actor_id.slice(0, 8)}` : ""} · {formatCairoDateTime(row.created_at, locale)}
              </p>
              <p className="text-muted-foreground">{t.drawer}: {row.cash_drawer_session_id ? row.cash_drawer_session_id.slice(0, 8) : "—"}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
