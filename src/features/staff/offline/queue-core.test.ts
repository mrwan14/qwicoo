import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyResults,
  backoffMs,
  buildBatch,
  canCancel,
  computeTotals,
  displayNumber,
  forStage,
  newOfflineOrder,
  nextStep,
  offlineNumber,
  prune,
  summarise,
  withCancel,
  withTransition,
  type OfflineLine,
  type OfflineOrder,
  type PricingRules,
  type SyncResult,
} from "./queue-core.ts";

const BRANCH = "20203ddf-6916-4c32-b7a7-70fa5e398a84";
const DEVICE = "dev_9f2c7a1b";
const RULES: PricingRules = { tax_rate: "0.1400", service_fee_rate: "0.1200", is_service_taxable: false, service_fee_dine_in_only: true };
const croissant: OfflineLine = { item_id: "be3af02d-2583-4313-ae7b-12e6d83fe4aa", name: "Croissant", quantity: 2, unit_price: "30.00", modifiers: [] };

function order(n: number, extra: Partial<Parameters<typeof newOfflineOrder>[0]> = {}): OfflineOrder {
  return newOfflineOrder({
    id: `ord_${n}_aaaaaaaa`,
    branchId: BRANCH,
    deviceId: DEVICE,
    offlineNumber: offlineNumber(DEVICE, n),
    createdAt: `2026-10-07T10:0${n}:00.000Z`,
    orderType: "TAKEAWAY",
    tableId: null,
    tableLabel: null,
    lines: [croissant],
    rules: RULES,
    keys: [`create_${n}_kkkkkkkk`, `pay_${n}_kkkkkkkk`],
    seq: n * 10,
    payCash: true,
    ...extra,
  });
}

test("offline numbers carry a device code and match the API pattern", () => {
  const number = offlineNumber(DEVICE, 12);
  assert.equal(number, "OFF-7A1B-12");
  assert.match(number, /^OFF-[A-Za-z0-9]{0,8}-?\d{1,6}$/);
});

test("totals follow the API rules: takeaway skips a dine-in-only service fee", () => {
  assert.deepEqual(computeTotals([croissant], "TAKEAWAY", RULES), { subtotal: "60.00", service_fee_total: "0.00", tax_total: "8.40", total_amount: "68.40" });
  assert.deepEqual(computeTotals([croissant], "DINE_IN", RULES), { subtotal: "60.00", service_fee_total: "7.20", tax_total: "8.40", total_amount: "75.60" });
  assert.equal(computeTotals([croissant], "DINE_IN", { ...RULES, is_service_taxable: true }).tax_total, "9.41");
  // Half-up rounding: 10.05 × 14% = 1.407 → 1.41, and 0.25 × 10% = 0.025 → 0.03.
  assert.equal(computeTotals([{ ...croissant, quantity: 1, unit_price: "10.05" }], "TAKEAWAY", RULES).tax_total, "1.41");
  assert.equal(computeTotals([{ ...croissant, quantity: 1, unit_price: "0.25" }], "TAKEAWAY", { ...RULES, tax_rate: "0.1000" }).tax_total, "0.03");
});

test("a cash sale queues create then pay with the same totals", () => {
  const sale = order(1);
  assert.equal(sale.paid, true);
  assert.deepEqual(sale.actions.map((action) => action.payload.type), ["create_order", "pay_cash"]);
  const pay = sale.actions[1].payload;
  assert.equal(pay.type === "pay_cash" && pay.amount, "68.40");
  assert.equal(order(2, { payCash: false }).actions.length, 1);
});

test("kitchen and handover steps advance in order and cancel stops them", () => {
  let sale = order(1);
  assert.equal(nextStep(sale.status), "PREPARING");
  sale = withTransition(sale, "READY", "t1_kkkkkkkk", 100, "2026-10-07T10:05:00Z");
  assert.equal(sale.status, "READY");
  assert.equal(withTransition(sale, "PREPARING", "t2_kkkkkkkk", 101, "x"), sale, "never steps backwards");
  sale = withTransition(sale, "DELIVERED", "t3_kkkkkkkk", 102, "2026-10-07T10:06:00Z");
  assert.equal(canCancel(sale), false);
  let other = withCancel(order(2), "Guest left", "c1_kkkkkkkk", 103, "2026-10-07T10:07:00Z");
  assert.equal(other.status, "CANCELLED");
  other = withTransition(other, "PREPARING", "t4_kkkkkkkk", 104, "x");
  assert.equal(other.actions.length, 3);
});

test("batches are per branch, oldest first, and capped", () => {
  const a = withTransition(order(2), "PREPARING", "t_a_kkkkkkkk", 5, "2026-10-07T10:00:00Z");
  const b = order(1);
  const elsewhere = { ...order(3), branchId: "other-branch" };
  const batch = buildBatch([a, b, elsewhere], BRANCH);
  assert.deepEqual(batch.map((action) => action.idempotency_key), ["t_a_kkkkkkkk", "create_1_kkkkkkkk", "pay_1_kkkkkkkk", "create_2_kkkkkkkk", "pay_2_kkkkkkkk"]);
  assert.equal(buildBatch([a, b], BRANCH, 2).length, 2);
});

test("results map OFF-n to the real number; final=false stays queued", () => {
  const sale = order(1);
  const results: SyncResult[] = [
    { index: 0, type: "create_order", idempotency_key: "create_1_kkkkkkkk", client_order_id: sale.id, status: "applied", final: true, order_id: "srv-1", pickup_number: 105, order_status: "SUBMITTED", needs_review: true, review_reasons: [{ code: "ITEM_SOLD_OUT" }] },
    { index: 1, type: "pay_cash", idempotency_key: "pay_1_kkkkkkkk", client_order_id: sale.id, status: "error", code: "ORDER_NOT_SYNCED", final: false },
  ];
  const [after] = applyResults([sale], results, "2026-10-07T11:00:00Z");
  assert.equal(after.serverId, "srv-1");
  assert.equal(displayNumber(after), "#105");
  assert.equal(after.needsReview, true);
  assert.deepEqual(after.actions.map((action) => action.state), ["done", "pending"]);
  assert.equal(after.actions[1].attempts, 1);
  assert.equal(after.syncedAt, undefined);
  assert.deepEqual(summarise([after]), { waiting: 1, failed: 0, review: 1, total: 1 });

  const [done] = applyResults([after], [{ ...results[1], status: "replayed", final: true, code: null }], "2026-10-07T11:01:00Z");
  assert.equal(done.syncedAt, "2026-10-07T11:01:00Z");
  assert.equal(summarise([done]).waiting, 0);
  assert.equal(displayNumber(order(4)), "OFF-7A1B-4");
});

test("a final error leaves the queue but is reported", () => {
  const sale = order(1);
  const [after] = applyResults(
    [sale],
    [
      { index: 0, type: "create_order", idempotency_key: "create_1_kkkkkkkk", client_order_id: sale.id, status: "applied", order_id: "srv-1", pickup_number: 7 },
      { index: 1, type: "pay_cash", idempotency_key: "pay_1_kkkkkkkk", client_order_id: sale.id, status: "error", code: "ORDER_ALREADY_PAID", final: true },
    ],
    "2026-10-07T11:00:00Z",
  );
  assert.equal(after.lastError, "ORDER_ALREADY_PAID");
  assert.deepEqual(summarise([after]), { waiting: 0, failed: 1, review: 0, total: 1 });
});

test("when the order itself is refused, its later steps stop retrying", () => {
  const sale = order(1);
  const [after] = applyResults(
    [sale],
    [
      { index: 0, type: "create_order", idempotency_key: "create_1_kkkkkkkk", client_order_id: sale.id, status: "error", code: "VALIDATION_ERROR", final: true },
      { index: 1, type: "pay_cash", idempotency_key: "pay_1_kkkkkkkk", client_order_id: sale.id, status: "error", code: "ORDER_NOT_SYNCED", final: false },
    ],
    "2026-10-07T11:00:00Z",
  );
  assert.deepEqual(after.actions.map((action) => action.state), ["failed", "failed"]);
  assert.equal(summarise([after]).waiting, 0);
  assert.equal(after.syncedAt, "2026-10-07T11:00:00Z");
});

test("backoff doubles up to a minute", () => {
  const none = () => 0;
  assert.deepEqual([1, 2, 3, 4, 6, 10].map((n) => backoffMs(n, none)), [2000, 4000, 8000, 16000, 60000, 60000]);
  assert.equal(backoffMs(1, () => 1), 2400);
});

test("kitchen and handover lists, and pruning of old synced orders", () => {
  const cooking = withTransition(order(1), "PREPARING", "t1_kkkkkkkk", 100, "x");
  const ready = withTransition(order(2), "READY", "t2_kkkkkkkk", 101, "x");
  const cancelled = withCancel(order(3), "Guest left", "c3_kkkkkkkk", 102, "x");
  assert.deepEqual(forStage([ready, cooking, cancelled], BRANCH, "kitchen").map((o) => o.id), [cooking.id]);
  assert.deepEqual(forStage([ready, cooking, cancelled], BRANCH, "handover").map((o) => o.id), [ready.id]);
  const old = { ...order(4), actions: order(4).actions.map((a) => ({ ...a, state: "done" as const })), syncedAt: "2026-10-06T00:00:00Z" };
  assert.deepEqual(prune([old, cooking], Date.parse("2026-10-07T12:00:00Z")).map((o) => o.id), [cooking.id]);
});
