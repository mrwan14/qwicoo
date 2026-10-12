"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useStaffSession } from "@/components/ops/staff-session";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { browserApi } from "@/lib/api/browser";
import { getStaffOrder } from "@/lib/api/staff-order";
import { formatMoney } from "@/lib/format/money";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymobCopy } from "@/lib/i18n/staff/paymob";
import { amountWithinBalance } from "@/lib/paymob/checkout";
import { paymobError } from "@/lib/paymob/errors";
import { canRefundPaymob } from "@/lib/paymob/gateway";
import { refundableRemaining } from "@/lib/paymob/refund";

const field = "h-11 w-full border border-input bg-background px-3 text-sm";

export function PaymobRefunds({ orderId }: { orderId: string }) {
  const me = useStaffSession();
  const allowed = canRefundPaymob(me?.role);
  const { locale } = useLocale();
  const t = paymobCopy[locale];
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const order = useQuery({
    queryKey: ["staff-order", orderId],
    enabled: allowed,
    queryFn: () => getStaffOrder(orderId),
  });

  const refund = useMutation({
    mutationFn: async (paymentId: string) => {
      const typed = amount.trim();
      const payment = (order.data?.payments ?? []).find((row) => row.id === paymentId);
      if (!payment) throw new Error(t.refundFailed);
      const left = refundableRemaining(payment, order.data?.payments ?? []);
      if (typed && !amountWithinBalance(typed, left)) throw new Error(t.amountInvalid);
      const result = await browserApi.POST("/api/v1/payments/{payment_id}/refund", {
        params: { path: { payment_id: paymentId } },
        body: typed ? { amount: typed } : {},
      });
      if (!result.response.ok) throw paymobError(result.error, result.response, t.refundFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.refunded);
      setOpenId(null);
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-receipt", orderId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!allowed) return null;
  const payments = order.data?.payments ?? [];
  const captures = payments.filter(
    (payment) => payment.payment_method === "PAYMOB" && payment.status === "COMPLETED" && refundableRemaining(payment, payments) !== "0.00",
  );
  if (captures.length === 0) return null;
  const selected = captures.find((payment) => payment.id === openId) ?? null;
  const remaining = selected ? refundableRemaining(selected, payments) : "0.00";
  const currency = selected?.currency || "EGP";

  return (
    <div className="grid w-full gap-2">
      {captures.map((payment) => (
        <button
          key={payment.id}
          type="button"
          className="min-h-11 w-full border px-4 text-sm"
          onClick={() => {
            setAmount("");
            setOpenId(payment.id);
          }}
        >
          {t.refund} · {formatMoney(payment.amount, payment.currency || "EGP", locale)}
        </button>
      ))}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.refundTitle}</DialogTitle>
            <DialogDescription>{t.refundEstimate}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{fill(t.refundRemaining, { amount: formatMoney(remaining, currency, locale) })}</p>
          <label className="grid gap-1 text-sm">
            {t.refundAmount}
            <input className={field} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <span className="text-muted-foreground">{t.refundFull}</span>
          </label>
          <button
            type="button"
            className="min-h-11 w-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={!selected || refund.isPending}
            onClick={() => { if (selected) refund.mutate(selected.id); }}
          >
            {refund.isPending ? t.refunding : t.refundConfirm}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
