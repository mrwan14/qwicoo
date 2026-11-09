/**
 * Loads a newest-first list page by page until it reaches rows older than `from`, the list ends,
 * or `maxPages` runs out. The list endpoints behind Till and Payments have no date filter, so a
 * single page silently cut busy periods short.
 *
 * Stops early only when a page is really newest-first (its first row is not older than its last)
 * and its last row is already before `from`. A list in any other order is read to the end.
 */
export async function loadSince<T>({
  from,
  dayOf,
  load,
  limit = 100,
  maxPages = 30,
}: {
  /** First day wanted, YYYY-MM-DD. */
  from: string;
  /** The row's calendar day, YYYY-MM-DD. */
  dayOf: (row: T) => string;
  load: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>;
  limit?: number;
  maxPages?: number;
}): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await load(page * limit, limit);
    rows.push(...result.rows);
    if (result.rows.length < limit || rows.length >= result.total) return { rows, complete: true };
    const first = dayOf(result.rows[0]);
    const last = dayOf(result.rows[result.rows.length - 1]);
    if (first >= last && last < from) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Months (YYYY-MM-01) touched by an inclusive day range. */
export function monthsIn(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * Cancellation rate across branches, weighted by orders. Each row gives paid orders and its own
 * rate; total orders are paid / (1 − rate), so a 3-order branch no longer counts as much as a
 * 3,000-order one.
 */
export function weightedCancelRate(rows: readonly { paid: number; ratePct: number }[]): number {
  let cancelled = 0;
  let total = 0;
  for (const row of rows) {
    const rate = Math.min(Math.max(row.ratePct, 0), 100) / 100;
    if (rate >= 1) continue;
    const orders = row.paid / (1 - rate);
    total += orders;
    cancelled += orders * rate;
  }
  return total > 0 ? (cancelled / total) * 100 : 0;
}
