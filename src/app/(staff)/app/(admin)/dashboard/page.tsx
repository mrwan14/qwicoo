"use client";

import { RoleGate } from "@/components/ops/screen";
import { AnalyticsScreen } from "@/features/staff/backoffice-screen";
import { useScope } from "@/stores/scope";

export default function Page() {
  const branchId = useScope((state) => state.branchId);
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === branchId)?.name);

  return (
    <RoleGate href="/app/dashboard">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-[length:var(--text-28)] font-semibold">Dashboard</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {branchName ? `How the products at ${branchName} are selling.` : "How this branch's products are selling."}
          </p>
        </div>
        {branchId ? <AnalyticsScreen view="dashboard" embedded branchId={branchId} /> : <p className="text-sm text-muted-foreground">Choose a branch to see its products.</p>}
      </div>
    </RoleGate>
  );
}
