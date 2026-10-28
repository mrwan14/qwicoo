"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { ComboScreen } from "@/features/staff/catalog-screen";
import { MenuHub } from "@/features/staff/menu/hub";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(menuCopy);
  return (
    <RoleGate href="/app/menu">
      <BranchGate screen={t.title}>
        <MenuHub tab="combos">
          <ComboScreen />
        </MenuHub>
      </BranchGate>
    </RoleGate>
  );
}
