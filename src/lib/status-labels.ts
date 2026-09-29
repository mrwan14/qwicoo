import type { components } from "@/lib/api/schema";

type OrderStatus = components["schemas"]["OrderStatus"];
type PaymentStatus = components["schemas"]["PaymentStatus"];
type PaymentMethod = components["schemas"]["PaymentMethod"];
type Occupancy = components["schemas"]["TableOccupancyState"];
type KitchenStation = components["schemas"]["KitchenStation"];

const ORDER_STATUS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_STAFF_CONFIRMATION: "Needs confirmation",
  SUBMITTED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  DELIVERED: "Served",
  PAID: "Paid",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PENDING_CASHIER_VERIFICATION: "Waiting for cash",
  COMPLETED: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD_TERMINAL: "Card terminal",
  POS_TERMINAL: "Card terminal",
  STRIPE: "Card",
  ONLINE_CARD: "Card",
  APPLE_PAY: "Apple Pay",
  LOCAL_WALLET: "Wallet",
  ONLINE_PREPAID: "Prepaid",
};

const OCCUPANCY: Record<Occupancy, string> = {
  AVAILABLE: "Available",
  SEATED: "Seated",
  AWAITING_FOOD: "Waiting for food",
  FOOD_SERVED: "Food served",
  BILL_REQUESTED: "Bill requested",
};

const STATION: Record<KitchenStation, string> = {
  HOT_KITCHEN: "Hot kitchen",
  COLD_KITCHEN: "Cold kitchen",
  BEVERAGE: "Drinks",
  DESSERT: "Dessert",
};

function fromMap<T extends string>(map: Record<T, string>, value: string | null | undefined, empty = "None"): string {
  if (!value) return empty;
  return map[value as T] ?? value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function orderStatusLabel(status: string | null | undefined): string {
  return fromMap(ORDER_STATUS, status);
}

export function paymentStatusLabel(status: string | null | undefined): string {
  return fromMap(PAYMENT_STATUS, status);
}

export function paymentMethodLabel(method: string | null | undefined): string {
  return fromMap(PAYMENT_METHOD, method);
}

export function occupancyLabel(state: string | null | undefined): string {
  return fromMap(OCCUPANCY, state);
}

export function stationLabel(station: string | null | undefined): string {
  return fromMap(STATION, station, "Kitchen");
}
