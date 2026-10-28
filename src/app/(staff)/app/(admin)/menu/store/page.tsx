"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { MenuStore } from "@/features/staff/menu/store";
import { MenuHub } from "@/features/staff/menu/hub";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(menuCopy);
  return (
    <RoleGate href="/app/menu">
      <BranchGate screen={t.title}>
        <MenuHub tab="store">
          <MenuStore />
        </MenuHub>
      </BranchGate>
    </RoleGate>
  );
}
