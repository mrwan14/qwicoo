/**
 * Staff order alerts: pure diffing of live-queue snapshots.
 * No React, no fetching. The watcher feeds it the same data the screens already poll.
 */

export type AlertRole =
  | "SUPER_ADMIN"
  | "BRAND_ADMIN"
  | "REGIONAL_MANAGER"
  | "BRANCH_ADMIN"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN_STAFF"
  | "RUNNER";

export type AlertKind =
  | "confirmation"
  | "floor-status"
  | "payment"
  | "service-request"
  | "kitchen-ticket"
  | "handover-ready";

export type ToneKind = "new" | "ready";

export type FloorRow = {
  table_id: string;
  table_number: string;
  active_order_id?: string | null;
  order_status?: string | null;
  branch_id?: string | null;
};
export type KitchenRow = {
  sub_ticket_id: string;
  order_id: string;
  branch_id?: string | null;
  table_number?: string | null;
  pickup_number?: number | null;
};
export type ExpoRow = {
  order_id: string;
  branch_id?: string | null;
  status: string;
  pickup_number?: number | null;
  display_number?: string | null;
};
export type ServiceRow = {
  id: string;
  branch_id?: string | null;
  table_number?: string | null;
  request_type: string;
};
export type PaymentRow = {
  id: string;
  order_id: string;
  branch_id?: string | null;
  pickup_number?: number | null;
  payment_method?: string | null;
  status?: string | null;
};

/** A source left undefined is not watched (or not loaded yet); it never produces events. */
export type Snapshot = {
  floor?: FloorRow[];
  kitchen?: KitchenRow[];
  expo?: ExpoRow[];
  service?: ServiceRow[];
  payments?: PaymentRow[];
};

export type AlertEvent = {
  kind: AlertKind;
  /** Order, ticket, request or payment id. Together with `status` it keys the ignore list. */
  entityId: string;
  status: string;
  /** "Table 4", "Pickup 12" or "Order". */
  place: string;
  branchId: string | null;
  tone: ToneKind;
  /** Raw detail for the toast (request type, payment method). */
  detail?: string | null;
};

export type Source = keyof Snapshot;

export const IGNORE_TTL_MS = 30_000;
export const TOAST_CAP = 3;

/** Which events each role hears, and which queues it needs (only ones its screens already use). */
const ROLE_KINDS: Record<AlertRole, readonly AlertKind[]> = {
  CASHIER: ["confirmation", "floor-status", "payment"],
  WAITER: ["confirmation", "floor-status", "service-request"],
  KITCHEN_STAFF: ["kitchen-ticket"],
  RUNNER: ["handover-ready", "service-request"],
  REGIONAL_MANAGER: ["confirmation", "floor-status", "payment", "service-request", "kitchen-ticket", "handover-ready"],
  SUPER_ADMIN: ["confirmation", "floor-status", "payment", "service-request", "kitchen-ticket", "handover-ready"],
  BRAND_ADMIN: ["confirmation", "floor-status", "payment", "service-request", "kitchen-ticket", "handover-ready"],
  BRANCH_ADMIN: ["confirmation", "floor-status", "payment", "service-request", "kitchen-ticket", "handover-ready"],
};

const KIND_SOURCE: Record<AlertKind, Source> = {
  confirmation: "floor",
  "floor-status": "floor",
  payment: "payments",
  "service-request": "service",
  "kitchen-ticket": "kitchen",
  "handover-ready": "expo",
};

export const ADMIN_ROLES: ReadonlySet<AlertRole> = new Set(["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"]);
export const OPS_ALERT_ROLES: ReadonlySet<AlertRole> = new Set(["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", "REGIONAL_MANAGER"]);

export type AlertAudience = { role: AlertRole; branchId: string | null; adminOptIn?: boolean };

export function alertsActive(audience: AlertAudience): boolean {
  if (ADMIN_ROLES.has(audience.role)) return Boolean(audience.adminOptIn);
  return OPS_ALERT_ROLES.has(audience.role);
}

export function kindsFor(audience: AlertAudience): readonly AlertKind[] {
  return alertsActive(audience) ? ROLE_KINDS[audience.role] : [];
}

/** Queues the watcher should subscribe to for this audience. */
export function sourcesFor(audience: AlertAudience): Source[] {
  return [...new Set(kindsFor(audience).map((kind) => KIND_SOURCE[kind]))];
}

export function placeLabel(
  row: { pickup_number?: number | null; table_number?: string | null; display_number?: string | null },
  labels: { pickup: string; table: string; order: string } = { pickup: "Pickup", table: "Table", order: "Order" },
): string {
  if (row.pickup_number != null) return `${labels.pickup} ${row.pickup_number}`;
  const table = (row.table_number ?? row.display_number ?? "").trim();
  return table ? `${labels.table} ${table}` : labels.order;
}

const READY_STATUSES = new Set(["READY"]);
const CONFIRM_STATUS = "PENDING_STAFF_CONFIRMATION";

function floorEvents(prev: FloorRow[], next: FloorRow[]): AlertEvent[] {
  const before = new Map<string, string | null>();
  for (const row of prev) if (row.active_order_id) before.set(row.active_order_id, row.order_status ?? null);
  const events: AlertEvent[] = [];
  for (const row of next) {
    const orderId = row.active_order_id;
    const status = row.order_status;
    if (!orderId || !status) continue;
    const had = before.has(orderId);
    const old = before.get(orderId);
    if (had && old === status) continue;
    const base = { entityId: orderId, status, place: placeLabel(row), branchId: row.branch_id ?? null };
    if (status === CONFIRM_STATUS) {
      events.push({ ...base, kind: "confirmation", tone: "new" });
    } else {
      events.push({ ...base, kind: "floor-status", tone: READY_STATUSES.has(status) ? "ready" : "new" });
    }
  }
  return events;
}

function newRows<T>(prev: T[], next: T[], id: (row: T) => string): T[] {
  const before = new Set(prev.map(id));
  return next.filter((row) => !before.has(id(row)));
}

function diffSource(source: Source, prev: Snapshot, next: Snapshot): AlertEvent[] {
  switch (source) {
    case "floor":
      return floorEvents(prev.floor!, next.floor!);
    case "kitchen":
      return newRows(prev.kitchen!, next.kitchen!, (row) => row.sub_ticket_id).map((row) => ({
        kind: "kitchen-ticket" as const,
        entityId: row.sub_ticket_id,
        status: "NEW",
        place: placeLabel(row),
        branchId: row.branch_id ?? null,
        tone: "new" as const,
      }));
    case "expo": {
      const before = new Map(prev.expo!.map((row) => [row.order_id, row.status]));
      return next
        .expo!.filter((row) => READY_STATUSES.has(row.status) && before.get(row.order_id) !== row.status)
        .map((row) => ({
          kind: "handover-ready" as const,
          entityId: row.order_id,
          status: row.status,
          place: placeLabel(row),
          branchId: row.branch_id ?? null,
          tone: "ready" as const,
        }));
    }
    case "service":
      return newRows(prev.service!, next.service!, (row) => row.id).map((row) => ({
        kind: "service-request" as const,
        entityId: row.id,
        status: "NEW",
        place: placeLabel(row),
        branchId: row.branch_id ?? null,
        tone: "new" as const,
        detail: row.request_type,
      }));
    case "payments": {
      // Dine-in payments carry no table number; borrow it from the floor when that queue is watched.
      const tableOf = new Map((next.floor ?? prev.floor ?? []).filter((row) => row.active_order_id).map((row) => [row.active_order_id!, row.table_number]));
      return newRows(prev.payments!, next.payments!, (row) => row.id).map((row) => ({
        kind: "payment" as const,
        entityId: row.id,
        status: row.status ?? "PENDING",
        place: placeLabel({ pickup_number: row.pickup_number, table_number: tableOf.get(row.order_id) ?? null }),
        branchId: row.branch_id ?? null,
        tone: "new" as const,
        detail: row.payment_method ?? null,
      }));
    }
  }
}

// ---------- Ignore list ----------

/** Key `${entityId}:${status}` → expiry (epoch ms). */
export type IgnoreList = Map<string, number>;

export function ignoreKey(entityId: string, status: string): string {
  return `${entityId}:${status}`;
}

export function addIgnore(list: IgnoreList, entityId: string, status: string, now: number, ttl = IGNORE_TTL_MS): IgnoreList {
  list.set(ignoreKey(entityId, status), now + ttl);
  return list;
}

export function pruneIgnore(list: IgnoreList, now: number): IgnoreList {
  for (const [key, expiry] of list) if (expiry <= now) list.delete(key);
  return list;
}

function isIgnored(list: IgnoreList, event: AlertEvent, now: number): boolean {
  const expiry = list.get(ignoreKey(event.entityId, event.status));
  return expiry != null && expiry > now;
}

// ---------- Main entry ----------

/**
 * Events between two snapshots for one person.
 * `prev` null means this is the first snapshot: a baseline, never an alert.
 * Each source is baselined on its own the first time it appears.
 */
export function diffSnapshots(
  prev: Snapshot | null,
  next: Snapshot,
  audience: AlertAudience,
  ignore: IgnoreList = new Map(),
  now = Date.now(),
): AlertEvent[] {
  if (!prev) return [];
  const kinds = new Set(kindsFor(audience));
  if (kinds.size === 0) return [];
  const sources = sourcesFor(audience);
  const events: AlertEvent[] = [];
  for (const source of sources) {
    if (!prev[source] || !next[source]) continue;
    events.push(...diffSource(source, prev, next));
  }
  // TODO(waiter-scope): floor data carries no table assignment yet, so waiters hear every table in the branch.
  return events.filter((event) => {
    if (!kinds.has(event.kind)) return false;
    if (event.branchId && audience.branchId && event.branchId !== audience.branchId) return false;
    return !isIgnored(ignore, event, now);
  });
}

/** Keep `next` sources that are defined, falling back to the old ones (a source that failed this poll keeps its baseline). */
export function mergeSnapshot(prev: Snapshot | null, next: Snapshot): Snapshot {
  return { ...(prev ?? {}), ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) };
}

export function groupForToasts(events: AlertEvent[], cap = TOAST_CAP): { shown: AlertEvent[]; more: number } {
  return { shown: events.slice(0, cap), more: Math.max(0, events.length - cap) };
}

/** One tone per poll; `ready` wins over `new`. */
export function toneFor(events: AlertEvent[]): ToneKind | null {
  if (events.length === 0) return null;
  return events.some((event) => event.tone === "ready") ? "ready" : "new";
}
