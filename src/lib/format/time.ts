/** Show an API timestamp in Africa/Cairo. Do not use this for arithmetic. */
export function formatCairoDateTime(value: string | null | undefined, locale = "en-GB"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
