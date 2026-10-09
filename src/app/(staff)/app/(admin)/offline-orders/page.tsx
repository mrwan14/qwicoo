"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { OfflineReviewScreen } from "@/features/staff/offline/offline-review-screen";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/offline-orders">
      <BranchGate screen={nav.offlineOrders}>
        <OfflineReviewScreen />
      </BranchGate>
    </RoleGate>
  );
}
