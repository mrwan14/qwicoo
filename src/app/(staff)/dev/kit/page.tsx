import { notFound } from "next/navigation";

import { KitPreview } from "@/features/staff/kit-preview";

/** Component sheet for the staff redesign. Development only: production builds return 404. */
export default function KitPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitPreview />;
}
