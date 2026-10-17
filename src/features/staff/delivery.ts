import type { LocaleCode } from "@/lib/i18n/locale-text";
import type { UserRole } from "@/lib/auth/roles";

const DELIVERY_LABELS = {
  awaiting_dispatch: {
    en: "Ready, waiting for the driver",
    ar: "جاهز، بانتظار السائق",
  },
  on_the_way: {
    en: "On the way",
    ar: "في الطريق",
  },
  delivered: {
    en: "Delivered",
    ar: "تم التسليم",
  },
} as const;

export type DeliveryStep = keyof typeof DELIVERY_LABELS;

const ADMIN_CANCEL_ROLES = new Set<UserRole>(["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"]);
const FRONT_OF_HOUSE = new Set<UserRole>(["CASHIER", "WAITER"]);

export type CancelOffer = "hidden" | "reject" | "cancel" | "locked";

export type DeliveryAddress = {
  label: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
  phone: string;
  latitude: string;
  longitude: string;
};

export type DeliveryLine = {
  name: string;
  quantity: number;
  badge: string | null;
};

/** Today's board payload, plus the extra fields once the backend sends them. */
export type DeliveryOrder = {
  id: string;
  displayNumber: string;
  status: string;
  deliveryStatus: string;
  address: DeliveryAddress | null;
  total: string;
  isPaid: boolean;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryFee: string | null;
  paymentMethod: string | null;
  items: DeliveryLine[] | null;
};

export function isDeliveryFulfillment(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "DELIVERY";
}

export function deliveryStatusLabel(status: string | null | undefined, locale: LocaleCode): string | null {
  const key = (status ?? "").trim().toLowerCase();
  if (key !== "awaiting_dispatch" && key !== "on_the_way" && key !== "delivered") return null;
  return DELIVERY_LABELS[key][locale];
}

/** Delivery orders use the driver step. Anything else keeps the order status. */
export function staffOrderStatus(input: {
  fulfillmentType: string | null | undefined;
  deliveryStatus: string | null | undefined;
  fallback: string;
  locale: LocaleCode;
}): string {
  if (!isDeliveryFulfillment(input.fulfillmentType)) return input.fallback;
  return deliveryStatusLabel(input.deliveryStatus, input.locale) ?? input.fallback;
}

export function cancelOffer(role: UserRole | null | undefined, status: string | null | undefined): CancelOffer {
  if (!role) return "hidden";
  const current = (status ?? "").trim().toUpperCase();
  if (current === "PENDING_STAFF_CONFIRMATION") {
    return ADMIN_CANCEL_ROLES.has(role) || FRONT_OF_HOUSE.has(role) ? "reject" : "hidden";
  }
  if (current === "SUBMITTED" || current === "PREPARING") {
    if (ADMIN_CANCEL_ROLES.has(role)) return "cancel";
    if (FRONT_OF_HOUSE.has(role)) return "locked";
    return "hidden";
  }
  return "hidden";
}

/** Unpaid deliveries need a cash confirmation. Paid card orders send false and skip the dialog. */
export function deliveredCashCollected(isPaid: boolean): boolean {
  return !isPaid;
}

export function matchesOrderChannel(
  row: { order_source?: string | null; fulfillment_type?: string | null },
  channel: "" | "mobile" | "delivery" | "store",
): boolean {
  if (channel === "mobile") return (row.order_source ?? "").toUpperCase() === "TAKE_A_WAY_APP";
  if (channel === "delivery") return isDeliveryFulfillment(row.fulfillment_type);
  return true;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function addressFrom(value: unknown): DeliveryAddress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const address: DeliveryAddress = {
    label: text(row.label),
    street: text(row.street),
    building: text(row.building),
    floor: text(row.floor),
    apartment: text(row.apartment),
    landmark: text(row.landmark),
    phone: text(row.phone),
    latitude: text(row.latitude),
    longitude: text(row.longitude),
  };
  const filled = Object.values(address).some(Boolean);
  return filled ? address : null;
}

function linesFrom(value: unknown): DeliveryLine[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    const quantity = typeof row.quantity === "number" ? row.quantity : Number(row.quantity);
    if (!name || !Number.isFinite(quantity)) return [];
    return [{ name, quantity, badge: text(row.badge) || null }];
  });
}

export function parseDeliveryOrders(data: unknown): DeliveryOrder[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = text(row.id);
    if (!id) return [];
    const has = (key: string) => Object.prototype.hasOwnProperty.call(row, key);
    return [{
      id,
      displayNumber: text(row.display_number),
      status: text(row.status),
      deliveryStatus: text(row.delivery_status),
      address: addressFrom(row.address),
      total: text(row.total) || "0",
      isPaid: row.is_paid === true,
      createdAt: text(row.created_at),
      customerName: has("customer_name") ? text(row.customer_name) || null : null,
      customerPhone: has("customer_phone") ? text(row.customer_phone) || null : null,
      deliveryFee: has("delivery_fee") ? text(row.delivery_fee) || null : null,
      paymentMethod: has("payment_method") ? text(row.payment_method) || null : null,
      items: has("items") ? linesFrom(row.items) : null,
    }];
  });
}

export function mapLink(address: DeliveryAddress | null): string | null {
  if (!address?.latitude || !address.longitude) return null;
  return `https://maps.google.com/?q=${encodeURIComponent(`${address.latitude},${address.longitude}`)}`;
}

export function optionalRecordString(value: object, key: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  const raw = (value as Record<string, unknown>)[key];
  const cleaned = text(raw);
  return cleaned || null;
}
