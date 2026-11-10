/** "1250", "1,250.5" or "1250,50" as typed, as the string the API takes; null when it isn't an amount. */
export function cleanAmount(text: string): string | null {
  const value = text.trim().replace(/[\s,](?=\d{3}\b)/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Number(value).toFixed(2);
}
