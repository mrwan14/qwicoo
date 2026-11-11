import assert from "node:assert/strict";
import { test } from "node:test";

import { readLabels, sameBadges, withLabels } from "./labels.ts";

test("reads chef's pick from any old spelling, and new", () => {
  assert.deepEqual(readLabels(["Signature", "vegan"]), { chefPick: true, isNew: false });
  assert.deepEqual(readLabels(["NEW"]), { chefPick: false, isNew: true });
  assert.deepEqual(readLabels(null), { chefPick: false, isNew: false });
});

test("setting labels keeps other badges and drops old spellings", () => {
  assert.deepEqual(withLabels(["vegan", "Chefs-Pick", "new"], { chefPick: true, isNew: false }), ["vegan", "chef_pick"]);
  assert.deepEqual(withLabels(["spicy"], { chefPick: false, isNew: true }), ["spicy", "new"]);
  assert.ok(sameBadges(["new", "vegan"], ["vegan", "new"]));
  assert.ok(!sameBadges(["vegan"], ["vegan", "new"]));
});
