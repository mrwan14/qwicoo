/** Small, testable rules for supplier bills. */

/** Today in Cairo as YYYY-MM-DD. */
export function cairoDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A typed amount as the API wants it: two decimals, no grouping. Bad input becomes "0.00". */
export function moneyInput(value: string | number): string {
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? (Math.round(number * 100) / 100).toFixed(2) : "0.00";
}

/** Before-VAT plus VAT equals the total, to the piastre (the API's own rule). */
export function billTotalsMatch(subtotal: string, vat: string, total: string): boolean {
  const cents = (value: string) => Math.round(Number(moneyInput(value)) * 100);
  return Math.abs(cents(subtotal) + cents(vat) - cents(total)) <= 1;
}

/** 1 when billed above the order price, -1 below, 0 the same. */
export function priceChange(ordered: string, billed: string): number {
  const diff = Number(billed) - Number(ordered);
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.00005) return 0;
  return diff > 0 ? 1 : -1;
}
