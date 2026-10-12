export type PayAttempt = { key: string; fingerprint: string };

export function paymobOffered(source: unknown): boolean {
  return explicitPaymobOffer(source) === true;
}

/** `undefined` when the payload does not say either way. */
export function explicitPaymobOffer(source: unknown): boolean | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as {
    online_payments?: { paymob?: unknown };
    onlinePayments?: { paymob?: unknown };
  };
  const value = record.online_payments?.paymob ?? record.onlinePayments?.paymob;
  return typeof value === "boolean" ? value : undefined;
}

export function knownPhone(source: unknown): string {
  if (!source || typeof source !== "object") return "";
  const record = source as Record<string, unknown>;
  for (const key of ["phone", "customer_phone", "guest_phone"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  const customer = record.customer;
  if (customer && typeof customer === "object" && "phone" in customer && typeof customer.phone === "string") {
    return customer.phone.trim();
  }
  return "";
}

/** Digits, optional leading +. Spaces and dashes are ignored. */
export function normalizePaymobPhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s-]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

export function majorToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export function centsToMajor(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type BalanceOrder = {
  total_amount: string;
  is_paid?: boolean;
  payments?: { status: string; amount: string }[] | null;
};

/** Remaining balance in major units. Completed payments reduce the total. */
export function remainingBalance(order: BalanceOrder): string {
  if (order.is_paid) return "0.00";
  const total = majorToCents(order.total_amount);
  if (total == null) return "0.00";
  let paid = 0;
  for (const payment of order.payments ?? []) {
    if (payment.status !== "COMPLETED") continue;
    const amount = majorToCents(payment.amount);
    if (amount != null) paid += amount;
  }
  return centsToMajor(Math.max(0, total - paid));
}

export function amountWithinBalance(amount: string, remaining: string): boolean {
  const asked = majorToCents(amount.trim());
  const left = majorToCents(remaining);
  if (asked == null || left == null) return false;
  return asked > 0 && asked <= left;
}

export function attemptFingerprint(input: { orderId: string; amount: string; phone: string }): string {
  return `${input.orderId}|${input.amount}|${input.phone}`;
}

/** Reuse the key only when this attempt is retried with the same order, amount, and phone. */
export function nextPayAttempt(previous: PayAttempt | null, fingerprint: string, createKey: () => string): PayAttempt {
  if (previous && previous.fingerprint === fingerprint) return previous;
  return { key: createKey(), fingerprint };
}
