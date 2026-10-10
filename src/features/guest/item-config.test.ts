import assert from "node:assert/strict";
import { test } from "node:test";

import {
  configuredLineTotal,
  missingGroupName,
  toggleOption,
  unitIsComplete,
  unitPrice,
  type ModifierGroup,
  type UnitSelection,
} from "./item-config.ts";
import { groupMinimum, itemNeedsOptions } from "./item-options.ts";

const sauce: ModifierGroup = {
  id: "g-sauce",
  name: "Sauce",
  min_choices: 1,
  max_choices: 1,
  is_required: true,
  options: [
    { id: "o-marinara", modifier_group_id: "g-sauce", name: "Marinara", price_delta: "5.00", is_available: true },
    { id: "o-pesto", modifier_group_id: "g-sauce", name: "Pesto", price_delta: "8.00", is_available: true },
  ],
};

const toppings: ModifierGroup = {
  id: "g-top",
  name: "Toppings",
  min_choices: 0,
  max_choices: 2,
  is_required: false,
  options: [
    { id: "o-cheese", modifier_group_id: "g-top", name: "Cheese", price_delta: "10.00", is_available: true },
    { id: "o-olives", modifier_group_id: "g-top", name: "Olives", price_delta: "8.00", is_available: true },
    { id: "o-basil", modifier_group_id: "g-top", name: "Basil", price_delta: "5.00", is_available: true },
  ],
};

test("required groups need at least one choice", () => {
  assert.equal(groupMinimum(sauce), 1);
  assert.equal(itemNeedsOptions({ modifier_groups: [sauce, toppings] }), true);
  assert.equal(itemNeedsOptions({ modifier_groups: [toppings] }), false);
  assert.equal(missingGroupName([sauce, toppings], {}, (group) => String(group.name)), "Sauce");
});

test("single-select replaces the prior option; multi-select respects max", () => {
  let selection: UnitSelection = {};
  selection = toggleOption(selection, sauce, "o-marinara");
  selection = toggleOption(selection, sauce, "o-pesto");
  assert.deepEqual(selection["g-sauce"], ["o-pesto"]);

  selection = toggleOption(selection, toppings, "o-cheese");
  selection = toggleOption(selection, toppings, "o-olives");
  selection = toggleOption(selection, toppings, "o-basil");
  assert.deepEqual(selection["g-top"], ["o-olives", "o-basil"]);
  assert.equal(unitIsComplete([sauce, toppings], selection), true);
});

test("each unit prices options once and the line total equals the sum", () => {
  const base = 79.99;
  const unit1: UnitSelection = { "g-sauce": ["o-marinara"], "g-top": ["o-cheese"] };
  const unit2: UnitSelection = { "g-sauce": ["o-pesto"], "g-top": [] };
  const price1 = unitPrice(base, [sauce, toppings], unit1);
  const price2 = unitPrice(base, [sauce, toppings], unit2);
  assert.equal(price1, 94.99);
  assert.equal(price2, 87.99);

  const sameTotal = configuredLineTotal(base, [sauce, toppings], [unit1], 2, "same");
  assert.equal(sameTotal, 189.98);

  const perTotal = configuredLineTotal(base, [sauce, toppings], [unit1, unit2], 2, "per");
  assert.equal(perTotal, price1 + price2);
  assert.equal(perTotal, 182.98);
});
