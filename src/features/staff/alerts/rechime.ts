import type { ToneKind } from "./diff";

export const RECHIME_MS = 45_000;
export const MAX_RECHIMES = 2;

/** `tone` defaults to `new` (kitchen tickets and store orders). */
export type ChimeEntry = { ackId: string; last: number; count: number; tone?: ToneKind };

export function rechimeKey(source: string, id: string): string {
  return `${source}:${id}`;
}

/** The still-waiting items that should sound again now. Drops items that are gone, acknowledged, or out of repeats. */
export function dueRechimes(
  pending: Map<string, ChimeEntry>,
  liveKeys: ReadonlySet<string>,
  acknowledged: ReadonlySet<string>,
  now: number,
): ChimeEntry[] {
  const due: ChimeEntry[] = [];
  for (const [key, entry] of pending) {
    if (!liveKeys.has(key) || acknowledged.has(entry.ackId) || entry.count >= MAX_RECHIMES) {
      pending.delete(key);
      continue;
    }
    if (now - entry.last >= RECHIME_MS) {
      entry.last = now;
      entry.count += 1;
      due.push(entry);
    }
  }
  return due;
}

/** True when at least one still-waiting item should sound again. */
export function tickRechimes(
  pending: Map<string, ChimeEntry>,
  liveKeys: ReadonlySet<string>,
  acknowledged: ReadonlySet<string>,
  now: number,
): boolean {
  return dueRechimes(pending, liveKeys, acknowledged, now).length > 0;
}
