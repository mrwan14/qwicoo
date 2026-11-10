/** What a combo saves compared with buying its items separately. Shared by the staff builder and the guest menu. */
export type ComboSaving = {
  /** Price of the items bought separately, as a 2-decimal string. */
  regular: string;
  /** regular − combo price, as a 2-decimal string. */
  saving: string;
  /** Whole percent saved, rounded down so the menu never claims more than the real saving. */
  percent: number;
};

function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

const fromCents = (cents: number) => (cents / 100).toFixed(2);

/** Sum of price × quantity, or null when any price is unknown. */
export function comboRegularPrice(parts: { price: string | number | null | undefined; quantity: number }[]): string | null {
  let total = 0;
  for (const part of parts) {
    const cents = toCents(part.price);
    if (cents === null) return null;
    total += cents * part.quantity;
  }
  return fromCents(total);
}

/** Null when there is nothing to show: unknown prices, or the combo is not cheaper than its items. */
export function comboSaving(price: string | number | null | undefined, regular: string | number | null | undefined): ComboSaving | null {
  const combo = toCents(price);
  const separate = toCents(regular);
  if (combo === null || separate === null || separate <= 0 || combo >= separate) return null;
  const saved = separate - combo;
  return { regular: fromCents(separate), saving: fromCents(saved), percent: Math.floor((saved * 100) / separate) };
}
