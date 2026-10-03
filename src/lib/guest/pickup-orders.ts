const STORAGE_KEY = "pickup-orders";
const MAX_PICKUP_ORDERS = 5;

export type PickupOrderRecord = {
  orderId: string;
  branchId: string;
  accessToken: string;
  expiresAt: string;
  pickupNumber: number | null;
  amountDue: string;
  currency: string;
};

type StoredPickupOrder = PickupOrderRecord & { savedAt: number };

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function isStored(value: unknown): value is StoredPickupOrder {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredPickupOrder>;
  return (
    typeof entry.orderId === "string" &&
    typeof entry.branchId === "string" &&
    typeof entry.accessToken === "string" &&
    typeof entry.expiresAt === "string" &&
    typeof entry.amountDue === "string" &&
    typeof entry.currency === "string" &&
    (entry.pickupNumber == null || typeof entry.pickupNumber === "number") &&
    typeof entry.savedAt === "number"
  );
}

function expired(entry: StoredPickupOrder, now: number): boolean {
  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

function readMap(): Record<string, StoredPickupOrder> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, StoredPickupOrder> = {};
    for (const value of Object.values(parsed)) {
      if (isStored(value)) map[value.orderId] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** Drop expired rows and keep the newest remaining entries. */
function prune(map: Record<string, StoredPickupOrder>, now = Date.now()): Record<string, StoredPickupOrder> {
  const fresh = Object.values(map)
    .filter((entry) => !expired(entry, now))
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_PICKUP_ORDERS);
  return Object.fromEntries(fresh.map((entry) => [entry.orderId, entry]));
}

function writeMap(map: Record<string, StoredPickupOrder>) {
  if (!canUseStorage()) return;
  const next = prune(map);
  if (Object.keys(next).length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function load(): Record<string, StoredPickupOrder> {
  if (!canUseStorage()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const next = prune(readMap());
  const serialized = Object.keys(next).length === 0 ? null : JSON.stringify(next);
  if ((raw ?? null) !== serialized) {
    if (serialized == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, serialized);
  }
  return next;
}

function toRecord(entry: StoredPickupOrder): PickupOrderRecord {
  return {
    orderId: entry.orderId,
    branchId: entry.branchId,
    accessToken: entry.accessToken,
    expiresAt: entry.expiresAt,
    pickupNumber: entry.pickupNumber,
    amountDue: entry.amountDue,
    currency: entry.currency,
  };
}

export function savePickupOrder(input: PickupOrderRecord): PickupOrderRecord {
  const entry: StoredPickupOrder = { ...input, savedAt: Date.now() };
  writeMap({ ...readMap(), [entry.orderId]: entry });
  return toRecord(entry);
}

export function getPickupOrder(orderId: string): PickupOrderRecord | null {
  const entry = load()[orderId];
  return entry ? toRecord(entry) : null;
}

export function latestPickupOrder(branchId: string): PickupOrderRecord | null {
  const latest = Object.values(load())
    .filter((entry) => entry.branchId === branchId)
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  return latest ? toRecord(latest) : null;
}

export function removePickupOrder(orderId: string) {
  const map = readMap();
  delete map[orderId];
  writeMap(map);
}
