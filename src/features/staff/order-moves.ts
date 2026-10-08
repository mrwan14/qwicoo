import type { UserRole } from "@/lib/auth/roles";
import type { components } from "@/lib/api/schema";

export type OrderStatus = components["schemas"]["OrderStatus"];

/**
 * Roles that may move an order along the kitchen path.
 * Waiters only confirm or reject a pending order (403 on every other move).
 * Runners only hand a paid order over, and that control lives on Handover.
 */
const FLOOR_MOVE_ROLES = new Set<UserRole>([
  "CASHIER",
  "BRANCH_ADMIN",
  "BRAND_ADMIN",
  "REGIONAL_MANAGER",
  "SUPER_ADMIN",
  "KITCHEN_STAFF",
]);

/** DELIVERED and CLOSED are 409 PAYMENT_REQUIRED until the order is paid. SERVED is never a legal target. */
const PAYMENT_GATED = new Set<OrderStatus>(["DELIVERED", "CLOSED"]);

/**
 * Statuses the floor dropdown may offer. Edges match the order FSM.
 * Closed is only from Delivered, and only once the order is paid.
 */
export function floorStatusOptions(
  role: UserRole | null | undefined,
  status: OrderStatus | null | undefined,
  isPaid: boolean,
): OrderStatus[] {
  if (!role || !status || !FLOOR_MOVE_ROLES.has(role)) return [];
  const next: OrderStatus[] = [];
  if (status === "SUBMITTED") next.push("PREPARING");
  else if (status === "PREPARING") next.push("READY");
  else if (status === "READY") next.push("DELIVERED");
  else if (status === "DELIVERED") next.push("CLOSED");
  return next.filter((target) => isPaid || !PAYMENT_GATED.has(target));
}

/** Unpaid orders that cannot move to Delivered or Closed. The floor shows the amount due instead. */
export function showAmountDue(status: OrderStatus | null | undefined, isPaid: boolean): boolean {
  if (isPaid || !status) return false;
  return status === "READY" || status === "DELIVERED" || status === "SERVED";
}
