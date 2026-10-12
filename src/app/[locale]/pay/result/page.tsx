import { Suspense } from "react";

import { PayResultScreen } from "@/features/guest/pay-result-screen";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export default async function PayResultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <Suspense>
      <PayResultScreen locale={locale as LocaleCode} />
    </Suspense>
  );
}
