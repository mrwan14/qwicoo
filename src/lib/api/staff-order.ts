import { asApiError } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

/** GET /orders/{id} is on the API but not in the generated schema yet. */
export async function getStaffOrder(orderId: string): Promise<components["schemas"]["OrderResponse"]> {
  const { brandId, branchId } = useScope.getState();
  const headers = new Headers({ accept: "application/json" });
  if (brandId) headers.set("x-brand-id", brandId);
  if (branchId) headers.set("x-branch-id", branchId);
  const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
    credentials: "include",
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw asApiError(payload, response, "Couldn't load this order");
  }
  return payload as components["schemas"]["OrderResponse"];
}
