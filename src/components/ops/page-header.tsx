import type { ReactNode } from "react";

import { PageHeader as KitPageHeader } from "@/components/ops/kit/page-header";

/** Older screens' header, drawn as the kit page header (Fraunces title). */
export function PageHeader({
  title,
  action,
  detail,
}: {
  title: string;
  action?: ReactNode;
  detail?: ReactNode;
}) {
  return <KitPageHeader title={title} subtitle={detail} actions={action} />;
}
