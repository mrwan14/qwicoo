"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { MenuAdmin } from "@/features/staff/menu-screen";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(menuCopy);
  return (
    <RoleGate href="/app/menu">
      <BranchGate screen={t.title}>
        <MenuAdmin />
      </BranchGate>
    </RoleGate>
  );
}
