"use client";

import { useQuery } from "@tanstack/react-query";

import { useStaffSession } from "@/components/ops/staff-session";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { fetchReviewsSummary } from "@/lib/api/visit-reports";
import { rolesFor } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/roles";
import { useScope } from "@/stores/scope";

const REVIEW_ROLES: ReadonlySet<UserRole> = new Set(rolesFor("reports.reviews"));

/** Low guest ratings nobody has handled yet, for the Reports badge. Managers only. */
export function useLowRatingsCount(): number {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const interval = usePollingInterval(60_000);
  const allowed = Boolean(me && REVIEW_ROLES.has(me.role));
  const summary = useQuery({
    queryKey: ["reviews-summary", branchId],
    enabled: allowed,
    refetchInterval: interval,
    retry: false,
    queryFn: () => fetchReviewsSummary(branchId, "Could not load ratings"),
  });
  return allowed ? (summary.data?.unresolved_low ?? 0) : 0;
}
