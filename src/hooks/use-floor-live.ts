"use client";

import { useQuery } from "@tanstack/react-query";

import { useStaffSession } from "@/components/ops/staff-session";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { UserRole } from "@/lib/auth/roles";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

export type FloorOrderItem = {
  name?: string | null;
  item_name?: string | null;
  quantity: number;
  modifiers?: ({ name?: string | null } | string)[] | null;
  notes?: string | null;
  special_instructions?: string | null;
};

/** The live feed may also carry the active order's lines; older API builds send only the table snapshot. */
export type FloorTable = components["schemas"]["FloorTableLiveResponse"] & {
  display_number?: string | null;
  items?: FloorOrderItem[] | null;
  customer_notes?: string | null;
};

export type FloorLive = Omit<components["schemas"]["FloorSummaryResponse"], "tables"> & { tables: FloorTable[] };

/** Roles that see the pending-confirmation count on the Floor nav item. */
export const PENDING_BADGE_ROLES: ReadonlySet<UserRole> = new Set(["CASHIER", "WAITER", "BRANCH_ADMIN", "BRAND_ADMIN"]);

/** Roles offered Confirm / Reject on a pending table order. Kitchen never is. */
export const CONFIRM_ROLES: ReadonlySet<UserRole> = new Set([
  "CASHIER",
  "WAITER",
  "BRANCH_ADMIN",
  "BRAND_ADMIN",
  "REGIONAL_MANAGER",
  "SUPER_ADMIN",
]);

export function needsConfirmation(table: Pick<FloorTable, "order_status">): boolean {
  return table.order_status === "PENDING_STAFF_CONFIRMATION";
}

export function floorLiveQueryKey(branchId: string | null) {
  return ["floor-live", branchId] as const;
}

export async function fetchFloorLive(branchId: string | null): Promise<FloorLive> {
  const result = await browserApi.GET("/api/v1/floor/tables/live", {
    params: { header: { "X-Branch-ID": branchId ?? "" } },
  });
  if (result.response.status === 500) {
    throw new ApiError(500, "Floor data is unavailable right now.");
  }
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Floor failed");
  return result.data;
}

/** Pending-confirmation count for the Floor nav badge; null when this role or scope doesn't show one. */
export function usePendingConfirmationCount(): number | null {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const interval = usePollingInterval(15000);
  const enabled = Boolean(me && branchId && PENDING_BADGE_ROLES.has(me.role));
  const floor = useQuery({
    queryKey: floorLiveQueryKey(branchId),
    queryFn: () => fetchFloorLive(branchId),
    enabled,
    refetchInterval: pollUnlessRoleDenied(interval),
    retry: false,
  });
  if (!enabled || !floor.data) return null;
  return floor.data.tables.filter(needsConfirmation).length;
}
