export type UrlPayStatus = "paid" | "failed" | "pending";
export type ResultView = "confirming" | "paid" | "failed" | "timeout";

export function parseUrlPayStatus(value: string | null | undefined): UrlPayStatus | null {
  if (value === "paid" || value === "failed" || value === "pending") return value;
  return null;
}

type SettledOrder = {
  id?: string;
  is_paid?: boolean;
  payments?: { payment_method?: string; status?: string }[] | null;
};

/** The return URL never settles a payment. Only the order does. */
export function orderSettled(order: SettledOrder | null | undefined, orderId: string | null): boolean {
  if (!order) return false;
  if (orderId && order.id && order.id !== orderId) return false;
  if (order.is_paid) return true;
  return (order.payments ?? []).some((payment) => payment.payment_method === "PAYMOB" && payment.status === "COMPLETED");
}

export function resultView(input: { urlStatus: UrlPayStatus | null; settled: boolean; timedOut: boolean }): ResultView {
  if (input.settled) return "paid";
  if (input.urlStatus === "failed") return "failed";
  if (input.timedOut) return "timeout";
  return "confirming";
}

export const PAY_RESULT_POLL_MS = 3000;
export const PAY_RESULT_MAX_POLLS = 20;
