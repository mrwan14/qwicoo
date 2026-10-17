import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

export type StorePackStatus = "new" | "packed" | "handed_over";

export type StoreOnlineLine = {
  order_item_id: string;
  item_id: string;
  name: string;
  quantity: number;
};

export type StoreOnlineOrder = {
  order_id: string;
  display_number: string;
  pickup_number: number | null;
  store_pack_status: StorePackStatus;
  order_status: string;
  fulfillment_type: string;
  customer_first_name: string | null;
  vehicle_info: { plate?: string; colour?: string; color?: string; make?: string } | null;
  delivery_address_label: string | null;
  arrived_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: string;
  created_at: string;
  store_packed_at: string | null;
  store_packed_by_name: string | null;
  store_lines: StoreOnlineLine[];
  has_kitchen_items: boolean;
  branch_id?: string | null;
};

const STORE_ONLINE_PATH = "/api/v1/orders/store-online" as const;

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function parseOrder(value: unknown): StoreOnlineOrder | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const orderId = text(row.order_id);
  const status = text(row.store_pack_status);
  if (!orderId || (status !== "new" && status !== "packed" && status !== "handed_over")) return null;
  const vehicle = row.vehicle_info && typeof row.vehicle_info === "object" ? row.vehicle_info as StoreOnlineOrder["vehicle_info"] : null;
  const lines = Array.isArray(row.store_lines)
    ? row.store_lines.flatMap((line) => {
        if (!line || typeof line !== "object") return [];
        const item = line as Record<string, unknown>;
        const orderItemId = text(item.order_item_id);
        if (!orderItemId) return [];
        return [{
          order_item_id: orderItemId,
          item_id: text(item.item_id),
          name: text(item.name),
          quantity: typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 0,
        }];
      })
    : [];
  return {
    order_id: orderId,
    display_number: text(row.display_number),
    pickup_number: typeof row.pickup_number === "number" ? row.pickup_number : null,
    store_pack_status: status,
    order_status: text(row.order_status),
    fulfillment_type: text(row.fulfillment_type),
    customer_first_name: text(row.customer_first_name) || null,
    vehicle_info: vehicle,
    delivery_address_label: text(row.delivery_address_label) || null,
    arrived_at: text(row.arrived_at) || null,
    payment_method: text(row.payment_method) || null,
    payment_status: text(row.payment_status) || null,
    total_amount: text(row.total_amount),
    created_at: text(row.created_at),
    store_packed_at: text(row.store_packed_at) || null,
    store_packed_by_name: text(row.store_packed_by_name) || null,
    store_lines: lines,
    has_kitchen_items: row.has_kitchen_items === true,
    branch_id: text(row.branch_id) || null,
  };
}

export function parseStoreOnline(data: unknown): StoreOnlineOrder[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return rows.flatMap((row) => {
    const order = parseOrder(row);
    return order ? [order] : [];
  });
}

export async function storeOnlineAvailable(): Promise<boolean> {
  const result = await browserApi.GET(STORE_ONLINE_PATH, { params: { query: { status: "new" } } });
  if (result.response.status === 404 || result.response.status === 405) return false;
  if (!result.response.ok) throw asApiError(result.error, result.response, "Store orders failed");
  return true;
}

export async function fetchStoreOnline(status: StorePackStatus): Promise<StoreOnlineOrder[]> {
  const result = await browserApi.GET(STORE_ONLINE_PATH, { params: { query: { status } } });
  if (!result.response.ok) throw asApiError(result.error, result.response, "Store orders failed");
  return parseStoreOnline(result.data);
}

export async function markPacked(orderId: string): Promise<void> {
  const result = await browserApi.POST("/api/v1/orders/{order_id}/store-online/packed", {
    params: { path: { order_id: orderId } },
  });
  if (!result.response.ok) throw asApiError(result.error, result.response, "Store orders failed");
  ignoreOwnChange(orderId, "packed");
  ignoreOwnChange(orderId, "new");
}

export async function markHandedOver(orderId: string): Promise<void> {
  const result = await browserApi.POST("/api/v1/orders/{order_id}/store-online/handed-over", {
    params: { path: { order_id: orderId } },
  });
  if (!result.response.ok) throw asApiError(result.error, result.response, "Store orders failed");
  ignoreOwnChange(orderId, "handed_over");
  ignoreOwnChange(orderId, "new");
}
