/** How many choices a guest must and may pick in a group, in the words staff think in. */
export type ChoiceRule = { required: boolean; several: boolean; max: number };

export const MAX_PICKS = 10;

/** min/max from the API as a rule. Anything above one is "several". */
export function ruleOf(min: number, max: number): ChoiceRule {
  const upTo = Math.max(1, Math.min(MAX_PICKS, Math.round(max || 1)));
  return { required: min > 0, several: upTo > 1, max: upTo };
}

/** A rule back to the API's min/max. Required means at least one; several means up to `max` (2 or more). */
export function limitsOf(rule: ChoiceRule): { min_choices: number; max_choices: number; is_required: boolean } {
  const max = rule.several ? Math.max(2, Math.min(MAX_PICKS, Math.round(rule.max))) : 1;
  return { min_choices: rule.required ? 1 : 0, max_choices: max, is_required: rule.required };
}

/** A choice's extra price as typed: "", "10", "7.5" are fine; returns the string to send, or null if invalid. */
export function cleanPrice(text: string): string | null {
  const value = text.trim().replace(",", ".");
  if (value === "") return "0.00";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Number(value).toFixed(2);
}

/** Starting points for common groups, so staff don't have to think about the rules for the usual cases. */
export const PRESET_RULES = {
  size: { required: true, several: false, max: 1 },
  milk: { required: false, several: false, max: 1 },
  extras: { required: false, several: true, max: 5 },
  sauce: { required: false, several: false, max: 1 },
} as const satisfies Record<string, ChoiceRule>;
