"use client";

import { useQuery } from "@tanstack/react-query";

import { useStaffSession } from "@/components/ops/staff-session";
import { useScope } from "@/stores/scope";

import { expoKey, fetchExpoOrders } from "./queries";

/**
 * How many orders are ready to go out, for the runner's top-bar count. Same key as the alert watcher
 * and the Ready screen, so it shares their request instead of adding one.
 */
export function useReadyCount(): number {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const ready = useQuery({
    queryKey: expoKey(branchId),
    queryFn: fetchExpoOrders,
    enabled: me?.role === "RUNNER" && Boolean(branchId),
    refetchInterval: 15_000,
  });
  return (ready.data ?? []).filter((order) => order.status === "READY").length;
}
