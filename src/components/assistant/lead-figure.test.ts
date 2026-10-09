import assert from "node:assert/strict";
import { test } from "node:test";

import { extractLeadFigure } from "./lead-figure.ts";

test("lead figure prefers an EGP amount then a standalone number", () => {
  assert.deepEqual(extractLeadFigure("Gross sales today: EGP 9,340.00 across 112 orders."), {
    figure: "EGP 9,340.00",
    summary: "Gross sales today: across 112 orders",
  });
  assert.deepEqual(extractLeadFigure("Orders hit 112 before lunch."), {
    figure: "112",
    summary: "Orders hit before lunch",
  });
  assert.equal(extractLeadFigure("Nothing numeric here."), null);
});
