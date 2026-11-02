import { BrandDetailScreen } from "@/features/staff/brands-screen";
import { redirectLegacy } from "@/features/staff/legacy-redirect";
import { getApiOrigin } from "@/lib/env";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { brandId } = await params;
  // A brand admin's own brand page is now Home; App Admin still opens brands here.
  await redirectLegacy(`/app/brands/${brandId}`, await searchParams);
  return <BrandDetailScreen brandId={brandId} apiOrigin={getApiOrigin()} />;
}
