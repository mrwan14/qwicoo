import type { components } from "@/lib/api/schema";

type ModifierGroup = components["schemas"]["ModifierGroupResponse"];
type MenuItem = components["schemas"]["MenuItemResponse"];

/** True when the guest must open the options sheet before adding. */
export function itemNeedsOptions(item: Pick<MenuItem, "modifier_groups">): boolean {
  const groups = (item.modifier_groups ?? []) as ModifierGroup[];
  return groups.some((group) => groupMinimum(group) > 0);
}

export function groupMinimum(group: Pick<ModifierGroup, "is_required" | "min_choices">): number {
  if (group.is_required) return Math.max(1, group.min_choices ?? 1);
  return group.min_choices ?? 0;
}

export function groupChoiceHint(
  group: Pick<ModifierGroup, "is_required" | "min_choices" | "max_choices">,
  labels: { required: string; chooseUpTo: string; chooseAtLeast: string; chooseBetween: string },
): string {
  const min = groupMinimum(group);
  const max = group.max_choices ?? 1;
  if (min > 0 && max === min) {
    return group.is_required ? labels.required : labels.chooseAtLeast.replace("{n}", String(min));
  }
  if (max > 1 && min === 0) return labels.chooseUpTo.replace("{n}", String(max));
  if (min > 0 && max > min) return labels.chooseBetween.replace("{min}", String(min)).replace("{max}", String(max));
  if (group.is_required) return labels.required;
  return "";
}
