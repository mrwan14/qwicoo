"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { QrScreen } from "@/features/staff/qr-screen";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(qrCopy);
  return (
    <RoleGate href="/app/qr">
      <BranchGate screen={t.title}>
        <QrScreen />
      </BranchGate>
    </RoleGate>
  );
}
