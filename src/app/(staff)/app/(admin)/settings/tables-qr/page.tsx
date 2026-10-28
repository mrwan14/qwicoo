"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { QrScreen } from "@/features/staff/qr-screen";
import { SettingsFrame } from "@/features/staff/settings/frame";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(settingsCopy);
  const qr = useStaffSection(qrCopy);
  return (
    <RoleGate href="/app/settings/tables-qr">
      <BranchGate screen={qr.title}>
        <SettingsFrame item="tablesQr" title={t.items.tablesQr.title} subtitle={t.items.tablesQr.body}>
          <QrScreen />
        </SettingsFrame>
      </BranchGate>
    </RoleGate>
  );
}
