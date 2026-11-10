"use client";

import { RoleGate } from "@/components/ops/screen";
import { ReviewsReport } from "@/features/staff/reports/visit-reports";

/** Same access as the sales reports: the API serves these to branch admins and above. */
export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <ReviewsReport />
    </RoleGate>
  );
}
