/**
 * Display conversion. A factor means one `from` unit equals `factor` of the `to` unit.
 * An ingredient-specific edge wins over a brand edge, matching ConversionTable.factor.
 */

export type ConversionEdge = {
  ingredientId: string | null;
  fromUnitId: string;
  toUnitId: string;
  factor: string;
};

type Directed = { from: string; to: string; factor: number };

const MAX_HOPS = 4;

function directed(edges: ConversionEdge[]): Directed[] {
  const out: Directed[] = [];
  for (const edge of edges) {
    const factor = Number(edge.factor);
    if (!(factor > 0)) continue;
    out.push({ from: edge.fromUnitId, to: edge.toUnitId, factor });
    out.push({ from: edge.toUnitId, to: edge.fromUnitId, factor: 1 / factor });
  }
  return out;
}

function bfs(edges: Directed[], src: string, dst: string): number | null {
  const queue: { node: string; soFar: number; hops: number }[] = [{ node: src, soFar: 1, hops: 0 }];
  const seen = new Set([src]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.hops >= MAX_HOPS) continue;
    for (const edge of edges) {
      if (edge.from !== current.node || seen.has(edge.to)) continue;
      const next = current.soFar * edge.factor;
      if (edge.to === dst) return next;
      seen.add(edge.to);
      queue.push({ node: edge.to, soFar: next, hops: current.hops + 1 });
    }
  }
  return null;
}

/** Multiply a quantity in `src` to express it in `dst`. Null when no path exists. */
export function conversionFactor(
  edges: readonly ConversionEdge[],
  ingredientId: string,
  src: string,
  dst: string,
): number | null {
  if (src === dst) return 1;
  const specific = directed(edges.filter((edge) => edge.ingredientId === ingredientId));
  const brand = directed(edges.filter((edge) => edge.ingredientId == null));
  const leaving = specific.filter((edge) => edge.from === src);
  if (leaving.length > 0) {
    const found = bfs(specific, src, dst);
    if (found != null) return found;
    for (const edge of leaving) {
      if (edge.to === dst) return edge.factor;
      const rest = bfs(brand, edge.to, dst);
      if (rest != null) return edge.factor * rest;
    }
    return null;
  }
  return bfs(brand, src, dst);
}

export function convertQty(
  qty: string | number,
  edges: readonly ConversionEdge[],
  ingredientId: string,
  fromUnitId: string,
  toUnitId: string,
): number | null {
  const factor = conversionFactor(edges, ingredientId, fromUnitId, toUnitId);
  if (factor == null) return null;
  const amount = typeof qty === "number" ? qty : Number(qty);
  if (!Number.isFinite(amount)) return null;
  return amount * factor;
}
