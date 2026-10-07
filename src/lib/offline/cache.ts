/**
 * Snapshots the till needs to keep selling offline, refreshed whenever the API answers.
 * Stored per branch in IndexedDB (see idb.ts).
 */
import { kvGet, kvSet } from "@/lib/offline/idb";
import { isUnreachable, useNetwork } from "@/lib/offline/network";

export type Snapshot<T> = { savedAt: number; data: T };

export const offlineKeys = {
  me: () => "session:me",
  menu: (branchId: string) => `menu:${branchId}`,
  tables: (branchId: string) => `tables:${branchId}`,
  branchConfig: (branchId: string) => `branch-config:${branchId}`,
};

export async function saveSnapshot<T>(key: string, data: T): Promise<void> {
  await kvSet<Snapshot<T>>(key, { savedAt: Date.now(), data });
}

export async function loadSnapshot<T>(key: string): Promise<Snapshot<T> | undefined> {
  return kvGet<Snapshot<T>>(key);
}

/**
 * Run `load` online and keep a copy; when the API can't be reached, answer from the last copy.
 * Errors the API actually returned (403, 404, validation) are never masked by the cache.
 */
export async function withOfflineCopy<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const data = await load();
    void saveSnapshot(key, data);
    return data;
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (isUnreachable(error, status) || !useNetwork.getState().online) {
      const copy = await loadSnapshot<T>(key);
      if (copy) return copy.data;
    }
    throw error;
  }
}
