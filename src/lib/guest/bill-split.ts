/** Table bill maths for the guest pay sheet. Money is handled in whole cents. */

export type SplitMode = "full" | "mine" | "equal" | "custom";

export function toCents(value: string | number | null | undefined): number {
  const parsed = Number.parseFloat(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function fromCents(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

/** One person's share when the bill is split equally, rounded up to the cent and never above what is left. */
export function equalShare(total: string, remaining: string, people: number): string {
  const count = Math.max(1, Math.floor(people));
  const share = Math.ceil(toCents(total) / count);
  return fromCents(Math.min(share, toCents(remaining)));
}

export type SplitInput = {
  mode: SplitMode;
  total: string;
  remaining: string;
  myItemsDue: string;
  people: number;
  custom: string;
};

/** What the guest will pay for the chosen split. "0.00" means nothing can be paid that way. */
export function splitAmount(input: SplitInput): string {
  const left = toCents(input.remaining);
  if (left <= 0) return "0.00";
  if (input.mode === "full") return fromCents(left);
  if (input.mode === "mine") return fromCents(Math.min(toCents(input.myItemsDue), left));
  if (input.mode === "equal") return equalShare(input.total, input.remaining, input.people);
  const custom = toCents(input.custom);
  return fromCents(Math.min(Math.max(custom, 0), left));
}

/** A typed amount is payable when it is above zero and no more than what is left. */
export function customAmountValid(custom: string, remaining: string): boolean {
  if (!/^\s*\d+([.,]\d{0,2})?\s*$/.test(custom)) return false;
  const cents = toCents(custom);
  return cents > 0 && cents <= toCents(remaining);
}

/** The split the sheet opens on: my items when I ordered something unpaid, otherwise the full bill. */
export function defaultSplit(myItemsDue: string, guestsCount: number): SplitMode {
  if (toCents(myItemsDue) > 0 && guestsCount > 1) return "mine";
  return "full";
}
