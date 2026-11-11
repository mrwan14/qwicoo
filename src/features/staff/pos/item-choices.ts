import type { components } from "@/lib/api/schema";

type MenuItem = components["schemas"]["MenuItemResponse"];
type ModifierGroup = components["schemas"]["ModifierGroupResponse"];

/** The till's "All" category pill. */
export const ALL_CATEGORIES = "all";
/** The till's "Popular" pill: this branch's best sellers (last 30 days), up to POPULAR_MAX. */
export const POPULAR_CATEGORY = "popular";
export const POPULAR_MAX = 12;

/** Best sellers the cashier can sell now, most sold first. Works from the saved menu when offline. */
export function popularItems<I extends { id: string; is_available?: boolean | null }>(
  categories: readonly { items?: I[] | null }[],
  bestSellerIds: readonly string[] | null | undefined,
): I[] {
  const byId = new Map<string, I>();
  for (const category of categories) for (const item of category.items ?? []) byId.set(item.id, item);
  return (bestSellerIds ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is I => Boolean(item && item.is_available !== false))
    .slice(0, POPULAR_MAX);
}

export function groupMin(group: Pick<ModifierGroup, "is_required" | "min_choices">): number {
  if (group.is_required) return Math.max(1, group.min_choices);
  return group.min_choices;
}

export function groupRequired(group: Pick<ModifierGroup, "is_required" | "min_choices">): boolean {
  return groupMin(group) > 0;
}

/** Most options a guest can pick in a group; 1 means the group is a single choice. */
export function groupMax(group: Pick<ModifierGroup, "is_required" | "min_choices" | "max_choices">): number {
  return Math.max(group.max_choices ?? 1, groupMin(group), 1);
}

/** True when the item can't go on the ticket until the cashier picks something. */
export function needsChoices(item: Pick<MenuItem, "modifier_groups">): boolean {
  return (item.modifier_groups ?? []).some(groupRequired);
}

export type ChoiceRule =
  | { kind: "exactly"; count: number }
  | { kind: "between"; min: number; max: number }
  | { kind: "upTo"; count: number };

export function choiceRule(group: Pick<ModifierGroup, "is_required" | "min_choices" | "max_choices">): ChoiceRule {
  const min = groupMin(group);
  const max = groupMax(group);
  if (min > 0 && min === max) return { kind: "exactly", count: min };
  if (min > 0) return { kind: "between", min, max };
  return { kind: "upTo", count: max };
}

/**
 * Tapping an option. A single choice swaps; tapping it again clears it unless the group is
 * required. A multi choice stops at its limit, so the cashier un-ticks one before adding another.
 */
export function toggleChoice(
  current: readonly string[],
  group: Pick<ModifierGroup, "is_required" | "min_choices" | "max_choices">,
  optionId: string,
): string[] {
  const max = groupMax(group);
  if (current.includes(optionId)) {
    if (max === 1 && groupRequired(group)) return [...current];
    return current.filter((id) => id !== optionId);
  }
  if (max === 1) return [optionId];
  if (current.length >= max) return [...current];
  return [...current, optionId];
}

/** The first group still short of its minimum, or null when the item can be added. */
export function firstMissing<G extends Pick<ModifierGroup, "id" | "is_required" | "min_choices">>(
  groups: readonly G[],
  selected: Record<string, readonly string[]>,
): G | null {
  return groups.find((group) => (selected[group.id] ?? []).length < groupMin(group)) ?? null;
}

type Category = { id: string; items?: MenuItem[] | null };

/**
 * What the item grid shows: every category under "All", one category when a pill is picked,
 * and matches from every category while searching. Categories with nothing to show drop out.
 */
export function menuSections<C extends Category>(
  categories: readonly C[],
  categoryId: string,
  search: string,
  itemName: (item: MenuItem) => string,
): { category: C; items: MenuItem[] }[] {
  const needle = search.trim().toLowerCase();
  const scope = needle || categoryId === ALL_CATEGORIES ? categories : categories.filter((category) => category.id === categoryId);
  return scope
    .map((category) => ({
      category,
      items: (category.items ?? []).filter((item) => !needle || itemName(item).toLowerCase().includes(needle)),
    }))
    .filter((section) => section.items.length > 0);
}
