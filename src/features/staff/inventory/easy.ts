import { conversionFactor, type ConversionEdge } from "./units";

type StockLevel = { on_hand: string; par_level: string; reorder_level: string; status: "ok" | "low" | "out" | "negative" };

const URGENCY: Record<StockLevel["status"], number> = { negative: 0, out: 1, low: 2, ok: 3 };

/** Items that need ordering, out of stock first. */
export function needsAttention<T extends StockLevel>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.status !== "ok").sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);
}

/**
 * How much to order to get back to the "order up to" level, in the base unit. Falls back to the
 * "order when below" level when no target is set. Never negative.
 */
export function suggestedOrder(row: Pick<StockLevel, "on_hand" | "par_level" | "reorder_level">): number {
  const onHand = Number(row.on_hand) || 0;
  const par = Number(row.par_level) || 0;
  const target = par > 0 ? par : Number(row.reorder_level) || 0;
  const missing = target - Math.max(onHand, 0);
  return missing > 0 ? Math.round(missing * 1000) / 1000 : 0;
}

/** Units that make sense for one item: its base unit first, then any unit it converts to. */
export function unitsFor<U extends { id: string }>(
  units: readonly U[],
  edges: readonly ConversionEdge[],
  ingredientId: string,
  baseUnitId: string | undefined,
): U[] {
  if (!baseUnitId) return [...units];
  const base = units.find((unit) => unit.id === baseUnitId);
  const others = units.filter((unit) => unit.id !== baseUnitId && conversionFactor(edges, ingredientId, unit.id, baseUnitId) != null);
  return base ? [base, ...others] : others;
}

/** A readable, unique item code from its name, e.g. "Oat milk" → "OAT-MILK", then "OAT-MILK-2". */
export function autoSku(name: string, taken: readonly string[]): string {
  const stem =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .join("-")
      .slice(0, 24) || "ITEM";
  const used = new Set(taken.map((sku) => sku.toUpperCase()));
  if (!used.has(stem)) return stem;
  for (let n = 2; ; n++) {
    const next = `${stem}-${n}`;
    if (!used.has(next)) return next;
  }
}

/** A typed amount the API accepts: a positive number with at most three decimals. */
export function validAmount(value: string): boolean {
  return /^\d+(\.\d{1,3})?$/.test(value.trim()) && Number(value) > 0;
}
