"use client";

import { useQuery } from "@tanstack/react-query";

import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useScope } from "@/stores/scope";

/** Roles the API lets open, read and close a cash drawer. */
export const DRAWER_ROLES: ReadonlySet<string> = new Set(["CASHIER", "BRANCH_ADMIN", "SUPER_ADMIN"]);

/**
 * The branch's open cash drawer, or null when none is open. Same query key as the POS ticket,
 * so the strip, the ticket and the clock panel share one request.
 */
export function useDrawer({ enabled = true }: { enabled?: boolean } = {}) {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const allowed = DRAWER_ROLES.has(me?.role ?? "");
  const query = useQuery({
    queryKey: ["drawer", branchId],
    enabled: enabled && allowed && Boolean(branchId),
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/drawer/current");
      if (result.response.status === 404) return null;
      if (!result.response.ok) throw asApiError(result.error, result.response, "Drawer");
      return result.data ?? null;
    },
  });
  return { ...query, allowed };
}
