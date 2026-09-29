import { GuestShell } from "@/features/guest/shell";
import { PickupScreen } from "@/features/guest/pickup-screen";

export default async function PickupPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  return (
    <GuestShell resume={false}>
      <PickupScreen branchId={branchId} />
    </GuestShell>
  );
}
