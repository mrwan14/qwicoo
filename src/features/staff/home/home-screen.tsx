"use client";

import { RoleGate } from "@/components/ops/screen";
import { AnalyticsScreen } from "@/features/staff/backoffice-screen";
import { BrandDetailScreen, BrandsScreen } from "@/features/staff/brands-screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { useScope } from "@/stores/scope";

/** Home for App Admin (platform), brand admins (their brand) and branch admins (their branch). */
export function HomeScreen({ apiOrigin }: { apiOrigin: string }) {
  const me = useStaffSession();
  const homeScope = useScope((state) => state.homeScope);
  const branchId = useScope((state) => state.branchId);
  return (
    <RoleGate href="/app/home">
      {homeScope === "platform" ? (
        <BrandsScreen />
      ) : homeScope === "brand" && me?.brand_id ? (
        <BrandDetailScreen brandId={me.brand_id} apiOrigin={apiOrigin} />
      ) : (
        <AnalyticsScreen view="dashboard" embedded branchId={branchId} />
      )}
    </RoleGate>
  );
}
