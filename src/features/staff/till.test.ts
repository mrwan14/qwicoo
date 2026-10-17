import assert from "node:assert/strict";
import { test } from "node:test";

import { drawerCloseFigures } from "./till.ts";

test("an open drawer never shows the expected cash", () => {
  assert.equal(drawerCloseFigures({ status: "OPEN", calculated_cash_amount: "100.00", cash_variance: "0.00" }), null);
  assert.equal(drawerCloseFigures(null), null);
});

test("a closed drawer shows the calculated cash and the variance", () => {
  assert.deepEqual(
    drawerCloseFigures({ status: "CLOSED", calculated_cash_amount: "240.00", cash_variance: "-5.00" }),
    { calculated: "240.00", variance: "-5.00" },
  );
});
