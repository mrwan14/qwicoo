/** A table open this long has almost certainly been left open by mistake. */
export const STALE_AFTER_MINUTES = 12 * 60;

/** How long a table has been occupied, short: "12 min", "2 h 05", "3 days" (Arabic: "١٢ د", "٢ س ٠٥", "٣ أيام"). */
export function seatedShort(minutes: number, locale: string): string {
  const ar = locale === "ar";
  const n = (value: number, pad = false) =>
    (pad ? String(value).padStart(2, "0") : String(value)).replace(/\d/g, (d) => (ar ? "٠١٢٣٤٥٦٧٨٩"[Number(d)] : d));
  const safe = Math.max(0, Math.floor(minutes));
  if (safe < 60) return ar ? `${n(safe)} د` : `${n(safe)} min`;
  if (safe < 24 * 60) return ar ? `${n(Math.floor(safe / 60))} س ${n(safe % 60, true)}` : `${n(Math.floor(safe / 60))} h ${n(safe % 60, true)}`;
  const days = Math.floor(safe / (24 * 60));
  if (ar) return days === 1 ? "يوم" : days === 2 ? "يومان" : days <= 10 ? `${n(days)} أيام` : `${n(days)} يومًا`;
  return days === 1 ? "1 day" : `${days} days`;
}

export function isStale(minutes: number): boolean {
  return minutes >= STALE_AFTER_MINUTES;
}
