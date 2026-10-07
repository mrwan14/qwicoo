/** Plain-English labels for the flags the API puts on offline orders. */
type Reason = Record<string, unknown>;

function money(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function reasonLabel(reason: Reason): string {
  const name = typeof reason.name === "string" && reason.name ? reason.name : "An item";
  switch (reason.code) {
    case "OFFLINE_DISABLED":
      return "Offline selling was switched off for this branch";
    case "CLOCK_AHEAD":
      return "The till's clock was ahead, so the sync time was used";
    case "OFFLINE_TOO_LONG":
      return `Synced more than ${money(reason.max_hours) || "the allowed"} hours after the sale`;
    case "NO_OPEN_DRAWER":
      return "No cash drawer was open at the time";
    case "DRAWER_CLOSED_BEFORE_SYNC":
      return "Its drawer closed before it synced, so the cash counts in the current drawer";
    case "TABLE_MISSING":
      return "The table wasn't found, so it's kept without a table";
    case "ITEM_MISSING":
      return `${name} is no longer on the menu and wasn't added`;
    case "ITEM_SOLD_OUT":
      return `${name} was sold out`;
    case "PRICE_CHANGED":
      return `${name} sold at ${money(reason.offline_price)}, now ${money(reason.current_price)}`;
    case "TOTAL_MISMATCH":
      return `The till's total ${money(reason.device_total)} differs from ${money(reason.calculated_total)}`;
    case "NO_KNOWN_ITEMS":
      return "None of the items are on the menu any more";
    case "CASH_AMOUNT_MISMATCH":
      return `Cash taken ${money(reason.paid)} differs from the total ${money(reason.total)}`;
    case "CANCELLED_AFTER_CLOSE":
      return "Cancelled on the till after the order was already closed";
    default:
      return typeof reason.code === "string" ? reason.code.replace(/_/g, " ").toLowerCase() : "Needs a look";
  }
}
