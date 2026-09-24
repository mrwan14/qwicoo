import { RoleGate } from "@/components/ops/screen";
import { BranchScreen } from "@/features/staff/branch-screen";

export default async function Page({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  return (
    <RoleGate href="/app/brands">
      <BranchScreen branchId={branchId} />
    </RoleGate>
  );
}
