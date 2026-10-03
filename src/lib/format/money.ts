/** Display an API decimal string. Do not use this for arithmetic. */
export function formatMoney(
  amount: string,
  currency?: string | null,
  locale = "en",
): string {
  const code = currency?.trim() || "EGP";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
    }).format(value);
  } catch {
    return `${amount} ${code}`;
  }
}
