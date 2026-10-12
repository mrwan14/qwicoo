import type { ConversionEdge } from "./units";
import { convertQty } from "./units";

export type PrepLine = {
  ingredientId: string;
  qty: string;
  unitId: string;
  wastePct: string;
};

export type PrepRecipe = {
  id: string;
  prepIngredientId: string | null;
  yieldQty: string;
  isActive: boolean;
  lines: PrepLine[];
};

export type PrepIngredient = {
  id: string;
  sku: string;
  isPrep: boolean;
  baseUnitId: string;
};

export type PrepFailure = {
  ok: false;
  code: "RECIPE_NOT_FOUND" | "RECIPE_CYCLE" | "RECIPE_TOO_DEEP" | "UNIT_CONVERSION_NOT_FOUND" | "INGREDIENT_NOT_FOUND" | "INVALID_YIELD";
};

export type PrepPreview =
  | { ok: true; leaves: { ingredientId: string; sku: string; qty: number }[] }
  | PrepFailure;

const MAX_DEPTH = 3;

function money(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Leaf quantities for `batches` of a prep recipe.
 * A prep ingredient that has its own recipe is expanded, not consumed.
 */
export function previewPrepConsumption(
  recipe: PrepRecipe,
  batches: number,
  recipes: readonly PrepRecipe[],
  ingredients: readonly PrepIngredient[],
  edges: readonly ConversionEdge[],
): PrepPreview {
  if (!(batches > 0) || !(Number(recipe.yieldQty) > 0)) return { ok: false, code: "INVALID_YIELD" };
  const byPrep = new Map(
    recipes.filter((item) => item.isActive && item.prepIngredientId).map((item) => [item.prepIngredientId as string, item]),
  );
  const byIngredient = new Map(ingredients.map((item) => [item.id, item]));
  const produced = batches * Number(recipe.yieldQty);
  const exploded = explode(recipe, produced, byPrep, byIngredient, edges, 1, []);
  if (!exploded.ok) return exploded;
  return {
    ok: true,
    leaves: [...exploded.totals.entries()]
      .filter(([, qty]) => qty !== 0)
      .map(([ingredientId, qty]) => ({
        ingredientId,
        sku: byIngredient.get(ingredientId)?.sku ?? "",
        qty: money(qty),
      })),
  };
}

function explode(
  recipe: PrepRecipe,
  portions: number,
  byPrep: Map<string, PrepRecipe>,
  ingredients: Map<string, PrepIngredient>,
  edges: readonly ConversionEdge[],
  depth: number,
  stack: string[],
): { ok: true; totals: Map<string, number> } | PrepFailure {
  if (depth > MAX_DEPTH) return { ok: false, code: "RECIPE_TOO_DEEP" };
  if (stack.includes(recipe.id)) return { ok: false, code: "RECIPE_CYCLE" };
  if (!(Number(recipe.yieldQty) > 0)) return { ok: false, code: "INVALID_YIELD" };
  const batchCount = portions / Number(recipe.yieldQty);
  const totals = new Map<string, number>();
  for (const line of recipe.lines) {
    const ingredient = ingredients.get(line.ingredientId);
    if (!ingredient) return { ok: false, code: "INGREDIENT_NOT_FOUND" };
    const raw = Number(line.qty) * batchCount * (1 + Number(line.wastePct || 0) / 100);
    const sub = ingredient.isPrep ? byPrep.get(ingredient.id) : undefined;
    if (sub && sub.isActive) {
      const need = convertQty(raw, edges, ingredient.id, line.unitId, ingredient.baseUnitId);
      if (need == null) return { ok: false, code: "UNIT_CONVERSION_NOT_FOUND" };
      const nested = explode(sub, need, byPrep, ingredients, edges, depth + 1, [...stack, recipe.id]);
      if (!nested.ok) return nested;
      for (const [key, qty] of nested.totals) totals.set(key, (totals.get(key) ?? 0) + qty);
    } else {
      const qty = convertQty(raw, edges, ingredient.id, line.unitId, ingredient.baseUnitId);
      if (qty == null) return { ok: false, code: "UNIT_CONVERSION_NOT_FOUND" };
      totals.set(ingredient.id, (totals.get(ingredient.id) ?? 0) + qty);
    }
  }
  return { ok: true, totals };
}
