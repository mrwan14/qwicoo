function channel(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

const DRIVE_THRU = new Set(["DRIVE_THRU", "CURBSIDE", "CURBSIDE_PICKUP"]);
const TAKEAWAY = new Set(["TAKEAWAY", "POS_TAKEAWAY", "WEB_PICKUP", "MOBILE", "TAKE_A_WAY"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Row title on Payments. Pickup number wins; otherwise the channel, then the table. */
export function paymentPlaceLabel(payment: {
  pickup_number?: number | null;
  fulfillment_type?: string | null;
  table_number?: string | null;
  display_number?: string | null;
}): string {
  if (payment.pickup_number != null) return `Pickup ${payment.pickup_number}`;
  const kind = channel(payment.fulfillment_type);
  if (DRIVE_THRU.has(kind)) return "Drive-thru";
  if (TAKEAWAY.has(kind)) return "Takeaway";
  const table = (payment.table_number ?? payment.display_number ?? "").trim();
  return table ? `Table ${table}` : "Table";
}

/** Kitchen ticket subtitle. Drive-thru stays drive-thru even when the order is priced as takeaway. */
export function kitchenTicketKind(ticket: {
  order_type?: string | null;
  order_channel?: string | null;
  fulfillment_type?: string | null;
}): string {
  const kind = channel(ticket.order_channel || ticket.fulfillment_type);
  if (DRIVE_THRU.has(kind)) return "Drive-thru";
  if (TAKEAWAY.has(kind) || ticket.order_type === "TAKEAWAY") return "Takeaway";
  if (ticket.order_type === "DINE_IN" || kind === "DINE_IN") return "Dine in";
  return "";
}

/** Plate, colour, and make from a kitchen ticket vehicle. */
export function vehicleDetails(vehicle: { [key: string]: unknown } | null | undefined): string {
  if (!vehicle) return "";
  const colour = text(vehicle.colour) || text(vehicle.color);
  const make = text(vehicle.make) || text(vehicle.model);
  const plate = text(vehicle.plate) || text(vehicle.plate_number);
  return [colour, make, plate].filter(Boolean).join(" · ");
}
