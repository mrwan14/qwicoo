/** Display an API decimal string. Do not use this for arithmetic. */
export function formatMoney(
  amount: string,
  currency = "EGP",
  locale = "en",
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}
