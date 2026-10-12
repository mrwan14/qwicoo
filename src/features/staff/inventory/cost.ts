import { formatMoney } from "@/lib/format/money";
import type { LocaleCode } from "@/lib/i18n/locale-text";

import { formatQty } from "./qty";

export function formatPlateCost(
  input: { cost: string; price: string | null; marginPct: string | null },
  currency: string,
  locale: LocaleCode | string,
): { cost: string; price: string | null; margin: string | null } {
  return {
    cost: formatMoney(input.cost, currency, locale),
    price: input.price == null ? null : formatMoney(input.price, currency, locale),
    margin: input.marginPct == null ? null : `${formatQty(input.marginPct, locale)}%`,
  };
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
