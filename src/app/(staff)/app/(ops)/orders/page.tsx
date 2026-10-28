"use client";

import { useSearchParams } from "next/navigation";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { OrdersHub } from "@/features/staff/orders/hub";
import { LiveOrders } from "@/features/staff/orders/live-orders";
import { TablesView } from "@/features/staff/orders/tables-view";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(ordersCopy);
  const view = useSearchParams().get("view") === "tables" ? "tables" : "list";
  return (
    <RoleGate href="/app/orders">
      <BranchGate screen={t.screen}>
        <OrdersHub tab="live" view={view}>
          {view === "tables" ? <TablesView /> : <LiveOrders />}
        </OrdersHub>
      </BranchGate>
    </RoleGate>
  );
}
