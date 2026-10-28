import assert from "node:assert/strict";
import { test } from "node:test";

import { toCsv } from "./csv.ts";

test("csv quotes only the cells that need it", () => {
  assert.equal(toCsv(["Item", "Sales"], [["Flat white", "110.00"], ['Latte, "large"', 95]]), 'Item,Sales\r\nFlat white,110.00\r\n"Latte, ""large""",95');
  assert.equal(toCsv(["A"], [[null], [undefined]]), "A\r\n\r\n");
});
