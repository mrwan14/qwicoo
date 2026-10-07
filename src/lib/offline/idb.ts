/**
 * Tiny IndexedDB wrapper for the offline till. One database, two stores:
 * - `kv`: cached snapshots (menu, tables, branch settings, session) keyed by string.
 * - `queue`: offline actions waiting to sync (see queue.ts), keyed by `id`.
 * Every call resolves to a safe default when IndexedDB is unavailable (private mode, SSR).
 */

const DB_NAME = "qwicoo-offline";
const DB_VERSION = 1;
export const KV_STORE = "kv";
export const QUEUE_STORE = "queue";

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (opening) return opening;
  opening = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (os: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(store, mode);
          const request = work(tx.objectStore(store));
          tx.oncomplete = () => resolve(request.result);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await run<T>(KV_STORE, "readonly", (os) => os.get(key) as IDBRequest<T>)) ?? undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await run(KV_STORE, "readwrite", (os) => os.put(value, key));
}

export async function kvDelete(key: string): Promise<void> {
  await run(KV_STORE, "readwrite", (os) => os.delete(key));
}

export async function queueAll<T>(): Promise<T[]> {
  return (await run<T[]>(QUEUE_STORE, "readonly", (os) => os.getAll() as IDBRequest<T[]>)) ?? [];
}

export async function queuePut<T extends { id: string }>(value: T): Promise<void> {
  await run(QUEUE_STORE, "readwrite", (os) => os.put(value));
}

export async function queueDelete(id: string): Promise<void> {
  await run(QUEUE_STORE, "readwrite", (os) => os.delete(id));
}

/** Wipe everything on sign-out so the next person on this device starts clean. */
export async function clearOfflineData(): Promise<void> {
  await run(KV_STORE, "readwrite", (os) => os.clear());
}
