import { groupMinimum } from "@/features/guest/item-options";
import type { components } from "@/lib/api/schema";

export type ModifierGroup = components["schemas"]["ModifierGroupResponse"];
export type ModifierOption = components["schemas"]["ModifierOptionResponse"];

/** Selected option ids keyed by modifier group id. */
export type UnitSelection = Record<string, string[]>;

export type ConfigMode = "same" | "per";

export function emptySelection(): UnitSelection {
  return {};
}

export function cloneSelection(selection: UnitSelection): UnitSelection {
  return Object.fromEntries(Object.entries(selection).map(([key, value]) => [key, [...value]]));
}

export function resizeUnits(
  units: UnitSelection[],
  quantity: number,
  mode: ConfigMode,
): UnitSelection[] {
  if (mode === "same") {
    return [cloneSelection(units[0] ?? emptySelection())];
  }
  const next = units.slice(0, quantity).map(cloneSelection);
  while (next.length < quantity) {
    next.push(cloneSelection(next[next.length - 1] ?? emptySelection()));
  }
  return next;
}

export function toggleOption(
  selection: UnitSelection,
  group: Pick<ModifierGroup, "id" | "max_choices">,
  optionId: string,
): UnitSelection {
  const existing = selection[group.id] ?? [];
  const max = group.max_choices ?? 1;
  const has = existing.includes(optionId);
  const next = has
    ? existing.filter((id) => id !== optionId)
    : max <= 1
      ? [optionId]
      : [...existing, optionId].slice(-max);
  return { ...selection, [group.id]: next };
}

export function missingGroupName(
  groups: readonly ModifierGroup[],
  selection: UnitSelection,
  nameOf: (group: ModifierGroup) => string,
): string | null {
  for (const group of groups) {
    const count = (selection[group.id] ?? []).length;
    if (count < groupMinimum(group)) return nameOf(group);
  }
  return null;
}

export function unitIsComplete(groups: readonly ModifierGroup[], selection: UnitSelection): boolean {
  return missingGroupName(groups, selection, () => "") === null;
}

export function optionDelta(option: Pick<ModifierOption, "price_delta">): number {
  const value = Number(option.price_delta);
  return Number.isFinite(value) ? value : 0;
}

/** Price one unit: base + each selected option delta exactly once. */
export function unitPrice(
  base: number,
  groups: readonly ModifierGroup[],
  selection: UnitSelection,
): number {
  let total = base;
  for (const group of groups) {
    for (const optionId of selection[group.id] ?? []) {
      const option = (group.options ?? []).find((entry) => entry.id === optionId);
      if (option) total += optionDelta(option);
    }
  }
  return total;
}

/**
 * Line total across configured units.
 * Same-for-all: unitPrice × quantity. Per-item: sum of each unit once.
 */
export function configuredLineTotal(
  base: number,
  groups: readonly ModifierGroup[],
  units: readonly UnitSelection[],
  quantity: number,
  mode: ConfigMode,
): number {
  if (mode === "same") {
    return unitPrice(base, groups, units[0] ?? emptySelection()) * quantity;
  }
  return units.slice(0, quantity).reduce((sum, selection) => sum + unitPrice(base, groups, selection), 0);
}

export function selectedOptionIds(selection: UnitSelection): string[] {
  return Object.values(selection).flat();
}

export function selectedGroupsPayload(selection: UnitSelection) {
  return Object.entries(selection)
    .filter(([, optionIds]) => optionIds.length > 0)
    .map(([group_id, option_ids]) => ({ group_id, option_ids }));
}

export function moneyString(value: number): string {
  return value.toFixed(2);
}
