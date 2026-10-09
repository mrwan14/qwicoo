import assert from "node:assert/strict";
import { test } from "node:test";

import { columnLabel, labelColumns } from "./column-labels.ts";

test("column keys map through the dictionary or become spaced words", () => {
  assert.equal(columnLabel("gross_sales", "en"), "Gross sales");
  assert.equal(columnLabel("cancelled_orders", "ar"), "الطلبات الملغاة");
  assert.equal(columnLabel("unknown_metric_name", "en"), "unknown metric name");
  assert.doesNotMatch(columnLabel("foo_bar_baz", "ar"), /_/);
  assert.deepEqual(labelColumns(["gross_sales", "weird_key"], "en"), ["Gross sales", "weird key"]);
});
