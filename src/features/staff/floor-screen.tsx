"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { occupancyTone, StatusChip, toneSurface } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { useWorkspace } from "@/stores/workspace";

const NEXT: components["schemas"]["OrderStatus"][] = ["PREPARING", "READY", "SERVED", "DELIVERED", "CLOSED"];

export function FloorScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useWorkspace((state) => state.branchId);
  const [selected, setSelected] = useState<components["schemas"]["FloorTableLiveResponse"] | null>(null);
  const [status, setStatus] = useState<components["schemas"]["OrderStatus"]>("PREPARING");
  const queryClient = useQueryClient();
  const floor = useQuery({
    queryKey: ["floor-live"],
    refetchInterval: interval,
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/floor/tables/live", {
        params: { header: { "X-Branch-ID": branchId ?? "" } },
      });
      if (result.response.status === 500) {
        throw new ApiError(500, "Floor data is unavailable right now.");
      }
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Floor failed");
      return result.data;
    },
  });

  const transition = useMutation({
    mutationFn: async () => {
      if (!selected?.active_order_id) return;
      const result = await browserApi.POST("/api/v1/orders/{order_id}/transition", {
        params: { path: { order_id: selected.active_order_id } },
        body: { target_status: status },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not move the order");
    },
    onSuccess: () => {
      toast.success("Order updated");
      void queryClient.invalidateQueries({ queryKey: ["floor-live"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (floor.isLoading) return <LoadingState label="Loading floor" />;
  if (floor.isError) {
    const message = floor.error instanceof Error ? floor.error.message : "Floor failed";
    return <ErrorState title="Floor unavailable" body={`${message} You can retry.`} onRetry={() => void floor.refetch()} />;
  }

  const data = floor.data;
  if (!data) return <ErrorState title="Floor unavailable" body="Floor data is unavailable right now." onRetry={() => void floor.refetch()} />;

  return (
    <div className="grid gap-4">
      <PageHeader title="Floor" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.occupied_tables} occupied</span>
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.available_tables} available</span>
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.tables_with_pending_requests} requests</span>
        <StatusChip tone="available">Available</StatusChip>
        <StatusChip tone="browsing">Seated</StatusChip>
        <StatusChip tone="ordered">Ordered</StatusChip>
        <StatusChip tone="ready">Served</StatusChip>
      </div>
      {data.tables.length === 0 ? (
        <EmptyState title="No tables on the floor" body="Add tables and QR codes for this branch, then refresh." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {data.tables.map((table) => {
            const tone = occupancyTone(table.current_state);
            return (
              <button key={table.table_id} type="button" className={`min-h-32 rounded-2xl p-4 text-start shadow-elev-1 ${toneSurface(tone)}`} onClick={() => setSelected(table)}>
                <span className="block text-2xl font-semibold">{table.table_number}</span>
                <span className="mt-2 block text-sm">{table.current_state.replaceAll("_", " ")}</span>
              </button>
            );
          })}
        </div>
      )}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{selected?.table_number}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-6">
            <p className="text-sm">{selected?.current_state}</p>
            <p className="text-sm">Order {selected?.order_status ?? "none"}</p>
            {selected?.active_order_id ? (
              <>
                <select className="h-12 rounded-lg border px-3" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                  {NEXT.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button type="button" className="min-h-12 rounded-lg bg-primary text-sm text-primary-foreground" onClick={() => transition.mutate()}>
                  Update order
                </button>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
