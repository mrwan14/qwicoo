import { RoleGate } from "@/components/ops/screen";
import { BrandDetailScreen } from "@/features/staff/brands-screen";

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <RoleGate href="/app/brands">
      <BrandDetailScreen brandId={brandId} />
    </RoleGate>
  );
}
