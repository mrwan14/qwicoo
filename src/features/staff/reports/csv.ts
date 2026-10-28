/** One CSV cell: quoted when it holds a comma, quote or line break. */
function cell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Downloads the table as UTF-8 with a BOM, so Excel shows Arabic names correctly. */
export function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]) {
  const blob = new Blob(["﻿", toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
