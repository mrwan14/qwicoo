"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ops/states";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** A crash on one dashboard page stays inside the page: the sidebar, top bar and branch switcher keep working. */
export default function StaffPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useStaffSection(commonCopy);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <ErrorState body={t.pageCrashed} onRetry={reset} retryLabel={t.tryAgain} />
    </div>
  );
}
