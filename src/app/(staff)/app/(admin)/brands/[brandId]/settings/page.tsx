import { BrandSettingsScreen } from "@/features/staff/brands-screen";

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return <BrandSettingsScreen brandId={brandId} />;
}
