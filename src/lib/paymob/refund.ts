import { centsToMajor, majorToCents } from "@/lib/paymob/checkout";

export type RefundPayment = {
  id: string;
  amount: string;
  status: string;
  payment_method: string;
};

/**
 * Estimate of what is left on one captured Paymob row: its amount minus refunded
 * Paymob rows on the same order. The refund call is the check.
 */
export function refundableRemaining(capture: RefundPayment, payments: RefundPayment[]): string {
  if (capture.payment_method !== "PAYMOB" || capture.status !== "COMPLETED") return "0.00";
  const captured = majorToCents(capture.amount);
  if (captured == null) return "0.00";
  let refunded = 0;
  for (const row of payments) {
    if (row.payment_method !== "PAYMOB" || row.status !== "REFUNDED") continue;
    const amount = majorToCents(row.amount);
    if (amount != null) refunded += amount;
  }
  return centsToMajor(Math.max(0, captured - refunded));
}
