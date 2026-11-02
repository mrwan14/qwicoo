"use client";

import { Card } from "@/components/ops/kit/card";
import { useStaffSession } from "@/components/ops/staff-session";
import { FloorScreen } from "@/features/staff/floor-screen";
import { RequestsScreen } from "@/features/staff/requests-screen";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

/** Orders → Tables: the live floor, with waiter calls beside it for roles that answer them. */
export function TablesView() {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);
  const calls = allowed.has("/app/floor/requests");
  return (
    <div className={calls ? "grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid grid-cols-1"}>
      <FloorScreen embedded />
      {calls ? (
        <Card>
          <RequestsScreen embedded />
        </Card>
      ) : null}
    </div>
  );
}
