import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addIgnore,
  diffSnapshots,
  groupForToasts,
  pruneIgnore,
  sourcesFor,
  toneFor,
  type AlertAudience,
  type Snapshot,
} from "./diff.ts";

const B1 = "branch-1";
const B2 = "branch-2";
const all = (role: AlertAudience["role"], extra: Partial<AlertAudience> = {}): AlertAudience => ({ role, branchId: B1, ...extra });

const empty: Snapshot = { floor: [], kitchen: [], expo: [], service: [], payments: [] };
const busy: Snapshot = {
  floor: [{ table_id: "t1", table_number: "4", active_order_id: "o1", order_status: "PENDING_STAFF_CONFIRMATION" }],
  kitchen: [{ sub_ticket_id: "k1", order_id: "o2", branch_id: B1, pickup_number: 12 }],
  expo: [{ order_id: "o3", branch_id: B1, status: "READY", display_number: "7" }],
  service: [{ id: "s1", branch_id: B1, table_number: "2", request_type: "CALL_WAITER" }],
  payments: [{ id: "p1", order_id: "o4", branch_id: B1, pickup_number: 3, payment_method: "CASH" }],
};

test("first snapshot is a baseline", () => {
  assert.deepEqual(diffSnapshots(null, busy, all("REGIONAL_MANAGER")), []);
});

test("a source seen for the first time is baselined on its own", () => {
  assert.deepEqual(diffSnapshots({ floor: [] }, busy, all("REGIONAL_MANAGER")).map((e) => e.kind), ["confirmation"]);
});

test("new items across every queue for a regional manager", () => {
  const kinds = diffSnapshots(empty, busy, all("REGIONAL_MANAGER")).map((e) => e.kind).sort();
  assert.deepEqual(kinds, ["confirmation", "handover-ready", "kitchen-ticket", "payment", "service-request"]);
});

test("floor status change and ready tone", () => {
  const next: Snapshot = { floor: [{ table_id: "t1", table_number: "4", active_order_id: "o1", order_status: "READY" }] };
  const events = diffSnapshots({ floor: busy.floor }, next, all("WAITER"));
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "floor-status");
  assert.equal(events[0].place, "Table 4");
  assert.equal(toneFor(events), "ready");
});

test("unchanged status gives nothing", () => {
  assert.deepEqual(diffSnapshots(busy, busy, all("REGIONAL_MANAGER")), []);
});

test("ignored change is swallowed, then expires after 30s", () => {
  const ignore = addIgnore(new Map(), "o1", "PENDING_STAFF_CONFIRMATION", 1000);
  assert.deepEqual(diffSnapshots(empty, busy, all("CASHIER"), ignore, 2000).filter((e) => e.kind === "confirmation"), []);
  const later = diffSnapshots(empty, busy, all("CASHIER"), ignore, 1000 + 30_001);
  assert.equal(later.filter((e) => e.kind === "confirmation").length, 1);
  pruneIgnore(ignore, 1000 + 30_001);
  assert.equal(ignore.size, 0);
});

test("ignore list is keyed by status too", () => {
  const ignore = addIgnore(new Map(), "o1", "SUBMITTED", 0);
  assert.equal(diffSnapshots(empty, busy, all("CASHIER"), ignore, 1).filter((e) => e.kind === "confirmation").length, 1);
});

test("cap of three toasts plus and N more", () => {
  const service = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, table_number: `${i}`, request_type: "CALL_WAITER" }));
  const events = diffSnapshots({ service: [] }, { service }, all("RUNNER"));
  const grouped = groupForToasts(events);
  assert.equal(grouped.shown.length, 3);
  assert.equal(grouped.more, 2);
  assert.equal(toneFor(events), "new");
  assert.equal(toneFor([]), null);
});

test("role filtering", () => {
  const kindsOf = (a: AlertAudience) => diffSnapshots(empty, busy, a).map((e) => e.kind).sort();
  assert.deepEqual(kindsOf(all("CASHIER")), ["confirmation", "payment"]);
  assert.deepEqual(kindsOf(all("WAITER")), ["confirmation", "service-request"]);
  assert.deepEqual(kindsOf(all("KITCHEN_STAFF")), ["kitchen-ticket"]);
  assert.deepEqual(kindsOf(all("RUNNER")), ["handover-ready", "service-request"]);
  for (const role of ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"] as const) {
    assert.deepEqual(kindsOf(all(role)), []);
    assert.equal(kindsOf(all(role, { adminOptIn: true })).length, 5);
  }
  assert.deepEqual(sourcesFor(all("KITCHEN_STAFF")), ["kitchen"]);
  assert.deepEqual(sourcesFor(all("BRANCH_ADMIN")), []);
});

test("regional manager hears only the selected branch", () => {
  const other: Snapshot = { kitchen: [{ sub_ticket_id: "k9", order_id: "o9", branch_id: B2 }] };
  assert.deepEqual(diffSnapshots({ kitchen: [] }, other, all("REGIONAL_MANAGER")), []);
  assert.equal(diffSnapshots({ kitchen: [] }, other, { role: "REGIONAL_MANAGER", branchId: B2 }).length, 1);
});

test("dine-in payment toast names the table from the floor", () => {
  const floor = [{ table_id: "t1", table_number: "4", active_order_id: "o4", order_status: "DELIVERED" }];
  const events = diffSnapshots({ floor, payments: [] }, { floor, payments: [{ id: "p9", order_id: "o4", payment_method: "CASH" }] }, all("CASHIER"));
  assert.equal(events.length, 1);
  assert.equal(events[0].place, "Table 4");
});
