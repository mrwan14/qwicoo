import { BranchScreen } from "@/features/staff/branch-screen";

export default async function Page({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  return <BranchScreen branchId={branchId} />;
}
