import assert from "node:assert/strict";
import { test } from "node:test";

import { ASSISTANT_ROLES, canAskQwicoo } from "@/lib/auth/roles.ts";
import { deniedUrl } from "@/lib/auth/scope.ts";
import { getNavItem } from "@/lib/nav.ts";

import { assistantSheetSide, canSeeAssistantUsage, selectAssistantBranch, starterKeys } from "./access.ts";

const cashier = {
  id: "00000000-0000-0000-0000-000000000001",
  tenant_id: "00000000-0000-0000-0000-000000000002",
  email: "cashier@example.com",
  full_name: "Cashier",
  role: "CASHIER" as const,
  is_active: true,
  home_scope: "branch",
  accessible_branches: [{ id: "00000000-0000-0000-0000-000000000003", name: "Main" }],
};

test("only admin roles can see Ask Qwicoo", () => {
  const item = getNavItem("/app/assistant");
  assert.deepEqual(item?.roles, [...ASSISTANT_ROLES]);
  assert.equal(item?.group, "insight");
  for (const role of ASSISTANT_ROLES) assert.equal(canAskQwicoo(role), true);
  for (const role of ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"] as const) {
    assert.equal(canAskQwicoo(role), false);
    assert.equal(item?.roles.includes(role), false);
  }
});

test("a cashier who opens the assistant is sent home", () => {
  assert.equal(deniedUrl(cashier), "/app/pos?denied=1");
});

test("the branch picker keeps only accessible branches", () => {
  const accessible = [
    { id: "branch-a", name: "Nasr City" },
    { id: "branch-b", name: "Zamalek" },
  ];
  assert.equal(selectAssistantBranch(accessible, "branch-b"), "branch-b");
  assert.equal(selectAssistantBranch(accessible, "branch-other"), "branch-a");
  assert.equal(selectAssistantBranch([], "branch-other"), null);
  assert.equal(starterKeys("BRANCH_ADMIN").includes("topBranch"), false);
  assert.equal(starterKeys("REGIONAL_MANAGER").includes("topBranch"), true);
  assert.equal(starterKeys("BRAND_ADMIN").at(-1), "topBranch");
  assert.equal(assistantSheetSide(true, "rtl"), "bottom");
  assert.equal(assistantSheetSide(false, "rtl"), "left");
  assert.equal(assistantSheetSide(false, "ltr"), "right");
  assert.equal(canSeeAssistantUsage("SUPER_ADMIN"), true);
  assert.equal(canSeeAssistantUsage("BRAND_ADMIN"), true);
  assert.equal(canSeeAssistantUsage("REGIONAL_MANAGER"), false);
});
