import { formatMoney } from "@/lib/format/money";

/**
 * Like `formatMoney`, but whole amounts drop the ".00" (EGP 18,450) as in the design.
 * Amounts with piastres keep two decimals. Display only: never parse the result.
 */
export function formatAmount(amount: string | number, currency?: string | null, locale = "en"): string {
  const text = typeof amount === "number" ? amount.toFixed(2) : amount;
  const formatted = formatMoney(text, currency, locale);
  const value = Number(text);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return formatted;
  return formatted.replace(/[.,٫]00(?=\D*$)/, "");
}
