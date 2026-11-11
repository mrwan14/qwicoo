/**
 * The two labels staff set by hand on the guest menu. "Best seller" is never set by hand: it comes
 * from real sales. Old spellings of the same labels are folded in, so switching one off removes them all.
 */
const CHEF_PICK = ["chef_pick", "chefs_pick", "chef", "signature", "featured"];
const NEW = ["new"];

function key(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function readLabels(badges: readonly string[] | null | undefined): { chefPick: boolean; isNew: boolean } {
  const keys = new Set((badges ?? []).map(key));
  return { chefPick: CHEF_PICK.some((name) => keys.has(name)), isNew: NEW.some((name) => keys.has(name)) };
}

/** The item's badges with the two labels set as chosen; every other badge (vegan, spicy...) is kept. */
export function withLabels(badges: readonly string[] | null | undefined, labels: { chefPick: boolean; isNew: boolean }): string[] {
  const kept = (badges ?? []).filter((badge) => !CHEF_PICK.includes(key(badge)) && !NEW.includes(key(badge)));
  return [...kept, ...(labels.chefPick ? ["chef_pick"] : []), ...(labels.isNew ? ["new"] : [])];
}

export function sameBadges(a: readonly string[] | null | undefined, b: readonly string[]): boolean {
  const left = [...(a ?? [])].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
