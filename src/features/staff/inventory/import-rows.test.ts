import assert from "node:assert/strict";
import { test } from "node:test";

import { errorRowsTable, importCounts, type ImportPreviewRow } from "./import-rows.ts";

const rows: ImportPreviewRow[] = [
  { line: 2, sku: "SUGAR", action: "create", values: { sku: "SUGAR", name_en: "Sugar", name_ar: "سكر", base_unit: "g" } },
  { line: 3, sku: "SUGAR", action: "same", same_as: 2, values: { sku: "SUGAR", store: "Kitchen" } },
  { line: 4, sku: "OIL", action: "error", message: "UNIT_NOT_FOUND", values: { sku: "OIL", name_en: "Oil", name_ar: "زيت", base_unit: "bottle", store: "Main" } },
  { line: 5, sku: "", action: "error", message: "INVALID_SKU", values: { name_en: "Mystery" } },
];

test("counts new, updates and rows to fix; same-item rows count as neither", () => {
  assert.deepEqual(importCounts(rows), { create: 1, update: 0, errors: 2 });
});

test("rows to fix keep their own cells, in template order, with the reason last", () => {
  const table = errorRowsTable(rows, (row) => `why ${row.message}`);
  assert.deepEqual(table.header, ["sku", "name_en", "name_ar", "base_unit", "store", "error"]);
  assert.deepEqual(table.body, [
    ["OIL", "Oil", "زيت", "bottle", "Main", "why UNIT_NOT_FOUND"],
    ["", "Mystery", "", "", "", "why INVALID_SKU"],
  ]);
});
