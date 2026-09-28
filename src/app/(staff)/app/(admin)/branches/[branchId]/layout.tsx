import type { ReactNode } from "react";

import { guardScope } from "@/lib/api/current-user";
import { canOpenBranch } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/** Every page under /app/branches/[branchId] inherits this check. */
export default async function BranchScopeLayout({
  params,
  children,
}: {
  params: Promise<{ branchId: string }>;
  children: ReactNode;
}) {
  const { branchId } = await params;
  await guardScope((me) => canOpenBranch(me, branchId));
  return children;
}
