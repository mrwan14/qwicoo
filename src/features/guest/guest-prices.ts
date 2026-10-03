/**
 * Figures the guest menu, item window, cart, and checkout are allowed to show.
 * The branch override wins over the catalogue price. Totals come from POST /orders/quote.
 * Modifier deltas are already inside a quote line, so they are not added again.
 */

export type BranchPrice = {
  /** Catalogue price. A branch override replaces this on screen. */
  base_price: string;
  /** Branch-resolved price. */
  final_price?: string | null;
};

export type QuoteLine = {
  /** Branch price plus modifier deltas. */
  unit_price: string;
  /** unit_price times quantity, as returned by the quote. */
  subtotal: string;
  modifier_deltas?: readonly string[];
};

export type QuotePricing = {
  subtotal: string;
  discount_total: string;
  service_fee_total: string;
  tax_total: string;
  total: string;
};

export function branchUnitPrice(item: BranchPrice): string {
  if (item.final_price == null || item.final_price === "") {
    throw new Error("Branch price is missing");
  }
  return item.final_price;
}

/** The quote subtotal already includes modifier deltas. */
export function quotedLineSubtotal(line: QuoteLine): string {
  return line.subtotal;
}

export function quotedOrderTotal(pricing: QuotePricing): string {
  return pricing.total;
}

export function guestQuoteFigures(pricing: QuotePricing): {
  subtotal: string;
  discount: string;
  serviceFee: string;
  tax: string;
  total: string;
} {
  return {
    subtotal: pricing.subtotal,
    discount: pricing.discount_total,
    serviceFee: pricing.service_fee_total,
    tax: pricing.tax_total,
    total: quotedOrderTotal(pricing),
  };
}
