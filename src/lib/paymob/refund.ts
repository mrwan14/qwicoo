/** Positive refundable amount from the API, or null when nothing is left. */
export function refundableAmount(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return `${Number(whole)}.${(frac + "00").slice(0, 2)}`;
}
