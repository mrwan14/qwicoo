import assert from "node:assert/strict";
import { test } from "node:test";

import { branchFromPath } from "./branch-path.ts";

const id = "80747db0-a5db-4ebf-9bd9-83e953b4413d";

test("a URL about one branch names that branch", () => {
  assert.equal(branchFromPath(`http://x/api/v1/branches/${id}`), id);
  assert.equal(branchFromPath(`http://x/api/v1/branches/${id}/financial-settings`), id);
  assert.equal(branchFromPath(`http://x/api/v1/branches/${id}?tab=money`), id);
});

test("other URLs leave the top-bar branch alone", () => {
  assert.equal(branchFromPath("http://x/api/v1/orders"), null);
  assert.equal(branchFromPath("http://x/api/v1/branches"), null);
  assert.equal(branchFromPath(`http://x/api/v1/brands/${id}/branches`), null);
});
