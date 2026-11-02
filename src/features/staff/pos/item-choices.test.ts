import assert from "node:assert/strict";
import { test } from "node:test";

import type { components } from "@/lib/api/schema";

import { ALL_CATEGORIES, choiceRule, firstMissing, menuSections, needsChoices, toggleChoice } from "./item-choices.ts";

type MenuItem = components["schemas"]["MenuItemResponse"];

const size = { id: "size", is_required: true, min_choices: 1, max_choices: 1 };
const milk = { id: "milk", is_required: false, min_choices: 0, max_choices: 1 };
const extras = { id: "extras", is_required: false, min_choices: 0, max_choices: 2 };

function item(id: string, name: string): MenuItem {
  return { id, name, base_price: "10.00", category_id: "c", is_available: true, item_type: "FOOD" } as MenuItem;
}

test("the rule under each group says how many to pick", () => {
  assert.deepEqual(choiceRule(size), { kind: "exactly", count: 1 });
  assert.deepEqual(choiceRule({ is_required: true, min_choices: 1, max_choices: 3 }), { kind: "between", min: 1, max: 3 });
  assert.deepEqual(choiceRule(extras), { kind: "upTo", count: 2 });
  assert.deepEqual(choiceRule(milk), { kind: "upTo", count: 1 });
});

test("a single choice swaps, and only an optional one clears on a second tap", () => {
  assert.deepEqual(toggleChoice(["regular"], size, "large"), ["large"]);
  assert.deepEqual(toggleChoice(["large"], size, "large"), ["large"]);
  assert.deepEqual(toggleChoice(["oat"], milk, "oat"), []);
});

test("a multi choice stops at its limit instead of dropping the first pick", () => {
  assert.deepEqual(toggleChoice(["shot"], extras, "syrup"), ["shot", "syrup"]);
  assert.deepEqual(toggleChoice(["shot", "syrup"], extras, "cream"), ["shot", "syrup"]);
  assert.deepEqual(toggleChoice(["shot", "syrup"], extras, "shot"), ["syrup"]);
});

test("the first short group is the one the cashier is sent to", () => {
  assert.equal(firstMissing([milk, size], {})?.id, "size");
  assert.equal(firstMissing([milk, size], { size: ["large"] }), null);
  assert.equal(needsChoices({ modifier_groups: [milk] as never }), false);
  assert.equal(needsChoices({ modifier_groups: [size] as never }), true);
});

test("All lists every category in menu order and skips empty ones", () => {
  const categories = [
    { id: "hot", items: [item("latte", "Latte"), item("tea", "Tea")] },
    { id: "empty", items: [] },
    { id: "cold", items: [item("iced", "Iced latte")] },
  ];
  const name = (row: MenuItem) => row.name;
  assert.deepEqual(menuSections(categories, ALL_CATEGORIES, "", name).map((section) => section.category.id), ["hot", "cold"]);
  assert.deepEqual(menuSections(categories, "cold", "", name).map((section) => section.items.length), [1]);
  const search = menuSections(categories, "cold", "LATTE", name);
  assert.deepEqual(search.map((section) => [section.category.id, section.items.map((row) => row.id)]), [
    ["hot", ["latte"]],
    ["cold", ["iced"]],
  ]);
});
