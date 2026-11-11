/** Columns the stock import reads, in the template's order. Extra columns in a file are ignored. */
export const IMPORT_COLUMNS = [
  "sku",
  "name_en",
  "name_ar",
  "base_unit",
  "category",
  "reorder_level",
  "par_level",
  "is_prep",
  "opening_qty",
  "opening_unit_cost",
] as const;

export type ImportAction = "create" | "update" | "same" | "error";

export type ImportPreviewRow = {
  line: number;
  sku: string;
  action: ImportAction;
  message?: string | null;
  opening_qty?: string | null;
  same_as?: number | null;
  values?: Record<string, string>;
};

export type ImportPreview = { rows: ImportPreviewRow[]; ignored_columns: string[] };
export type ImportResult = { created: number; updated: number; opened: number; skipped: number };

export function importCounts(rows: readonly { action: ImportAction }[]) {
  return {
    create: rows.filter((row) => row.action === "create").length,
    update: rows.filter((row) => row.action === "update").length,
    errors: rows.filter((row) => row.action === "error").length,
  };
}

/**
 * The rows that need fixing, as a table to save and re-upload: the file's own columns (template order
 * first, then any others it had) plus an "error" column. Fix the cells, delete the error column if you
 * like (it is ignored), and check the file again.
 */
export function errorRowsTable(
  rows: readonly ImportPreviewRow[],
  explain: (row: ImportPreviewRow) => string,
): { header: string[]; body: string[][] } {
  const failed = rows.filter((row) => row.action === "error");
  const seen = new Set<string>();
  for (const row of failed) for (const key of Object.keys(row.values ?? {})) seen.add(key);
  const known = IMPORT_COLUMNS.filter((key) => seen.has(key) || key === "sku");
  const others = [...seen].filter((key) => !(IMPORT_COLUMNS as readonly string[]).includes(key)).sort();
  const header = [...known, ...others, "error"];
  const body = failed.map((row) => [
    ...[...known, ...others].map((key) => (key === "sku" ? (row.values?.sku ?? row.sku) : (row.values?.[key] ?? ""))),
    explain(row),
  ]);
  return { header, body };
}
