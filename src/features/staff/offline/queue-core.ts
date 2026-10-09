/**
 * Offline till queue: pure logic (no browser APIs) so it runs under the node test runner.
 *
 * Each order sold offline is one queue record holding the actions taken on this device, in order
 * (create, pay cash, kitchen/handover steps, cancel). Every action has its own idempotency key, so
 * re-sending after a dropped connection can never double-charge or duplicate an order.
 */

export type OfflineOrderType = "TAKEAWAY" | "DINE_IN";
export type LocalStatus = "SUBMITTED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
export type TransitionTarget = "PREPARING" | "READY" | "DELIVERED";

export type OfflineModifier = { option_id: string; group_id: string | null; name: string; price_delta: string };

export type OfflineLine = {
  item_id: string;
  name: string;
  quantity: number;
  /** Unit price including modifiers, as the till charged it. */
  unit_price: string;
  modifiers: OfflineModifier[];
};

export type OfflineTotals = { subtotal: string; service_fee_total: string; tax_total: string; total_amount: string };

export type PricingRules = {
  tax_rate: string | number;
  service_fee_rate: string | number;
  is_service_taxable: boolean;
  service_fee_dine_in_only: boolean;
};

type ActionCommon = { idempotency_key: string; client_order_id: string; occurred_at: string };

export type SyncActionPayload =
  | (ActionCommon & {
      type: "create_order";
      offline_number: string;
      order_type: OfflineOrderType;
      table_id: string | null;
      items: OfflineLine[];
      totals: OfflineTotals;
      customer_notes: string | null;
    })
  | (ActionCommon & { type: "pay_cash"; amount: string; payment_method: "CASH" })
  | (ActionCommon & { type: "transition"; target_status: TransitionTarget })
  | (ActionCommon & { type: "cancel"; reason: string });

export type ActionState = "pending" | "done" | "failed";

export type QueuedAction = {
  seq: number;
  state: ActionState;
  attempts: number;
  code?: string | null;
  payload: SyncActionPayload;
};

export type SyncResult = {
  index: number;
  type: string;
  idempotency_key: string;
  client_order_id: string;
  status: "applied" | "replayed" | "skipped" | "error";
  code?: string | null;
  final?: boolean;
  order_id?: string | null;
  offline_number?: string | null;
  pickup_number?: number | null;
  table_number?: string | null;
  order_status?: string | null;
  is_paid?: boolean | null;
  total_amount?: string | number | null;
  needs_review?: boolean | null;
  review_reasons?: Array<Record<string, unknown>> | null;
};

export type OfflineOrder = {
  /** client_order_id: stable device-made id. */
  id: string;
  branchId: string;
  deviceId: string;
  offlineNumber: string;
  createdAt: string;
  orderType: OfflineOrderType;
  tableId: string | null;
  tableLabel: string | null;
  lines: OfflineLine[];
  totals: OfflineTotals;
  status: LocalStatus;
  paid: boolean;
  actions: QueuedAction[];
  /** Filled in once the API has the order. */
  serverId?: string | null;
  pickupNumber?: number | null;
  tableNumber?: string | null;
  serverStatus?: string | null;
  needsReview?: boolean;
  reviewReasons?: Array<Record<string, unknown>>;
  lastError?: string | null;
  syncedAt?: string | null;
};

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Short device code for OFF numbers: 4 letters/digits derived from the device id. */
export function deviceCode(deviceId: string): string {
  const clean = deviceId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (clean.slice(-4) || "TILL").padStart(4, "0");
}

/** Receipt number for the n-th offline order on this device, e.g. OFF-7F3A-12. */
export function offlineNumber(deviceId: string, counter: number): string {
  return `OFF-${deviceCode(deviceId)}-${Math.max(1, Math.trunc(counter)) % 1_000_000}`;
}

// ---- Money (integer cents, ROUND_HALF_UP like the API) ----

export function toCents(value: string | number): number {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  const negative = text.startsWith("-");
  const [whole = "0", frac = ""] = text.replace("-", "").split(".");
  const cents = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2)) + (Number((frac + "000")[2]) >= 5 ? 1 : 0);
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Rate such as "0.1400" as an integer in 1/10000ths. */
function rateUnits(rate: string | number): number {
  return Math.round(Number(rate) * 10_000);
}

function applyRate(cents: number, rate: string | number): number {
  // ROUND_HALF_UP on non-negative amounts.
  return Math.floor((cents * rateUnits(rate) + 5_000) / 10_000);
}

/** Same rules as the API's order financials, so synced totals match. */
export function computeTotals(lines: OfflineLine[], orderType: OfflineOrderType, rules: PricingRules): OfflineTotals {
  const subtotal = lines.reduce((sum, line) => sum + toCents(line.unit_price) * line.quantity, 0);
  const service = orderType === "TAKEAWAY" && rules.service_fee_dine_in_only ? 0 : applyRate(subtotal, rules.service_fee_rate);
  const tax = applyRate(rules.is_service_taxable ? subtotal + service : subtotal, rules.tax_rate);
  return {
    subtotal: fromCents(subtotal),
    service_fee_total: fromCents(service),
    tax_total: fromCents(tax),
    total_amount: fromCents(subtotal + service + tax),
  };
}

// ---- Building and acting on queued orders ----

export type NewOrderInput = {
  id: string;
  branchId: string;
  deviceId: string;
  offlineNumber: string;
  createdAt: string;
  orderType: OfflineOrderType;
  tableId: string | null;
  tableLabel: string | null;
  lines: OfflineLine[];
  rules: PricingRules;
  /** Keys for the create and pay actions. */
  keys: [string, string];
  seq: number;
  payCash: boolean;
};

export function newOfflineOrder(input: NewOrderInput): OfflineOrder {
  const totals = computeTotals(input.lines, input.orderType, input.rules);
  const actions: QueuedAction[] = [
    {
      seq: input.seq,
      state: "pending",
      attempts: 0,
      payload: {
        type: "create_order",
        idempotency_key: input.keys[0],
        client_order_id: input.id,
        occurred_at: input.createdAt,
        offline_number: input.offlineNumber,
        order_type: input.orderType,
        table_id: input.orderType === "DINE_IN" ? input.tableId : null,
        items: input.lines,
        totals,
        customer_notes: null,
      },
    },
  ];
  if (input.payCash && toCents(totals.total_amount) > 0) {
    actions.push({
      seq: input.seq + 1,
      state: "pending",
      attempts: 0,
      payload: {
        type: "pay_cash",
        idempotency_key: input.keys[1],
        client_order_id: input.id,
        occurred_at: input.createdAt,
        amount: totals.total_amount,
        payment_method: "CASH",
      },
    });
  }
  return {
    id: input.id,
    branchId: input.branchId,
    deviceId: input.deviceId,
    offlineNumber: input.offlineNumber,
    createdAt: input.createdAt,
    orderType: input.orderType,
    tableId: input.orderType === "DINE_IN" ? input.tableId : null,
    tableLabel: input.orderType === "DINE_IN" ? input.tableLabel : null,
    lines: input.lines,
    totals,
    status: "SUBMITTED",
    paid: actions.length > 1,
    actions,
  };
}

const FLOW: LocalStatus[] = ["SUBMITTED", "PREPARING", "READY", "DELIVERED"];

/** Next step for the kitchen / handover buttons, or null when there is none. */
export function nextStep(status: LocalStatus): TransitionTarget | null {
  const index = FLOW.indexOf(status);
  if (index < 0 || index >= FLOW.length - 1) return null;
  return FLOW[index + 1] as TransitionTarget;
}

export function canAdvance(order: OfflineOrder, target: TransitionTarget): boolean {
  if (order.status === "CANCELLED") return false;
  return FLOW.indexOf(target) > FLOW.indexOf(order.status);
}

export function canCancel(order: OfflineOrder): boolean {
  return order.status !== "CANCELLED" && order.status !== "DELIVERED";
}

export function withTransition(order: OfflineOrder, target: TransitionTarget, key: string, seq: number, at: string): OfflineOrder {
  if (!canAdvance(order, target)) return order;
  return {
    ...order,
    status: target,
    actions: [
      ...order.actions,
      { seq, state: "pending", attempts: 0, payload: { type: "transition", idempotency_key: key, client_order_id: order.id, occurred_at: at, target_status: target } },
    ],
  };
}

export function withCancel(order: OfflineOrder, reason: string, key: string, seq: number, at: string): OfflineOrder {
  if (!canCancel(order)) return order;
  return {
    ...order,
    status: "CANCELLED",
    actions: [
      ...order.actions,
      { seq, state: "pending", attempts: 0, payload: { type: "cancel", idempotency_key: key, client_order_id: order.id, occurred_at: at, reason } },
    ],
  };
}

// ---- Sync ----

export function pendingActions(order: OfflineOrder): QueuedAction[] {
  return order.actions.filter((action) => action.state === "pending");
}

export function isWaiting(order: OfflineOrder): boolean {
  return order.actions.some((action) => action.state === "pending");
}

/** Every pending action for one branch, oldest first, at most `limit` (the API takes 200). */
export function buildBatch(orders: OfflineOrder[], branchId: string, limit = 200): SyncActionPayload[] {
  return orders
    .filter((order) => order.branchId === branchId)
    .flatMap((order) => pendingActions(order))
    .sort((a, b) => a.seq - b.seq)
    .slice(0, limit)
    .map((action) => action.payload);
}

/**
 * Fold the API's per-action results back into the queue. Final results (applied, replayed,
 * skipped, or a final error) leave the queue; final=false keeps the action for the next try.
 */
export function applyResults(orders: OfflineOrder[], results: SyncResult[], syncedAt: string): OfflineOrder[] {
  const byKey = new Map(results.map((result) => [result.idempotency_key, result]));
  return orders.map((order) => {
    let changed = false;
    let next: OfflineOrder = order;
    const actions = order.actions.map((action) => {
      const result = byKey.get(action.payload.idempotency_key);
      if (!result || action.state !== "pending") return action;
      changed = true;
      const final = result.final !== false;
      if (!final) return { ...action, attempts: action.attempts + 1, code: result.code ?? null };
      return { ...action, state: (result.status === "error" ? "failed" : "done") as ActionState, code: result.code ?? null };
    });
    if (!changed) return order;
    // If the API refused the order itself for good, its later steps can never apply.
    if (actions.some((action) => action.payload.type === "create_order" && action.state === "failed")) {
      for (let i = 0; i < actions.length; i += 1) {
        if (actions[i].state === "pending") actions[i] = { ...actions[i], state: "failed", code: actions[i].code ?? "ORDER_NOT_CREATED" };
      }
    }
    next = { ...order, actions };
    for (const result of results) {
      if (result.client_order_id !== order.id) continue;
      if (result.order_id) next.serverId = result.order_id;
      if (result.pickup_number != null) next.pickupNumber = result.pickup_number;
      if (result.table_number != null) next.tableNumber = result.table_number;
      if (result.order_status) next.serverStatus = result.order_status;
      if (result.needs_review != null) next.needsReview = result.needs_review;
      if (result.review_reasons) next.reviewReasons = result.review_reasons;
    }
    const failed = actions.filter((action) => action.state === "failed");
    const retrying = actions.find((action) => action.state === "pending" && action.code);
    next.lastError = failed.length ? failed.map((action) => action.code ?? "ERROR").join(", ") : (retrying?.code ?? null);
    if (!isWaiting(next)) next.syncedAt = syncedAt;
    return next;
  });
}

/** Retry delay after a failed sync: 2s, 4s, 8s … capped at 60s, with up to 20% jitter. */
export function backoffMs(failures: number, random: () => number = Math.random): number {
  const base = Math.min(60_000, 2_000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (1 + 0.2 * random()));
}

export type QueueSummary = { waiting: number; failed: number; review: number; total: number };

export function summarise(orders: OfflineOrder[], branchId?: string | null): QueueSummary {
  const scoped = branchId ? orders.filter((order) => order.branchId === branchId) : orders;
  return {
    waiting: scoped.filter(isWaiting).length,
    failed: scoped.filter((order) => order.actions.some((action) => action.state === "failed")).length,
    review: scoped.filter((order) => order.needsReview).length,
    total: scoped.length,
  };
}

/** Number to show for an order: the real pickup / table number once synced, else OFF-n. */
export function displayNumber(order: OfflineOrder, tableLabel = "Table"): string {
  if (order.pickupNumber != null) return `#${order.pickupNumber}`;
  if (order.serverId && order.tableNumber) return `${tableLabel} ${order.tableNumber}`;
  return order.offlineNumber;
}

/** Synced orders are kept a while so staff can see their real numbers, then dropped. */
export function prune(orders: OfflineOrder[], now: number, keepMs = 12 * 60 * 60 * 1000): OfflineOrder[] {
  return orders.filter((order) => isWaiting(order) || !order.syncedAt || now - Date.parse(order.syncedAt) < keepMs);
}

/** Orders the kitchen or handover screen on this device should show. */
export function forStage(orders: OfflineOrder[], branchId: string, stage: "kitchen" | "handover"): OfflineOrder[] {
  const wanted: LocalStatus[] = stage === "kitchen" ? ["SUBMITTED", "PREPARING"] : ["READY"];
  return orders
    .filter((order) => order.branchId === branchId && wanted.includes(order.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
