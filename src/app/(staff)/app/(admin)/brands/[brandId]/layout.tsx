import type { ReactNode } from "react";

import { guardScope } from "@/lib/api/current-user";
import { canOpenBrand } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/** Every page under /app/brands/[brandId] inherits this check. */
export default async function BrandScopeLayout({
  params,
  children,
}: {
  params: Promise<{ brandId: string }>;
  children: ReactNode;
}) {
  const { brandId } = await params;
  await guardScope((me) => canOpenBrand(me, brandId));
  return children;
}
