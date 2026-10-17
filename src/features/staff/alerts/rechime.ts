export const RECHIME_MS = 45_000;
export const MAX_RECHIMES = 2;

export type ChimeEntry = { ackId: string; last: number; count: number };

export function rechimeKey(source: string, id: string): string {
  return `${source}:${id}`;
}

/** True when at least one still-waiting item should sound again. */
export function tickRechimes(
  pending: Map<string, ChimeEntry>,
  liveKeys: ReadonlySet<string>,
  acknowledged: ReadonlySet<string>,
  now: number,
): boolean {
  let chime = false;
  for (const [key, entry] of pending) {
    if (!liveKeys.has(key) || acknowledged.has(entry.ackId) || entry.count >= MAX_RECHIMES) {
      pending.delete(key);
      continue;
    }
    if (now - entry.last >= RECHIME_MS) {
      entry.last = now;
      entry.count += 1;
      chime = true;
    }
  }
  return chime;
}
