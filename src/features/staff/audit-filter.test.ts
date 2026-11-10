import assert from "node:assert/strict";
import { test } from "node:test";

import { isBackgroundAction } from "./audit-filter.ts";

test("heartbeats and push registrations are background noise", () => {
  assert.equal(isBackgroundAction("HTTP_POST_BRANCHES_{BRANCH_ID}_HEARTBEAT"), true);
  assert.equal(isBackgroundAction("HTTP_POST_STAFF_PUSH_SUBSCRIPTIONS"), true);
});

test("what people did stays visible", () => {
  for (const action of ["AUTH_LOGIN_SUCCESS", "ACCESS_FORBIDDEN", "HTTP_POST_ORDERS_{ORDER_ID}_TRANSITION", "BRANCH_UPDATED", ""]) {
    assert.equal(isBackgroundAction(action), false, action);
  }
  assert.equal(isBackgroundAction(null), false);
});
