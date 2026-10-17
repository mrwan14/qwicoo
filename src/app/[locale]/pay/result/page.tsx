import { Suspense } from "react";

import { GuestDocumentFonts } from "@/features/guest/document-fonts";
import { guestFontClassName } from "@/features/guest/guest-fonts";
import { PayResultScreen } from "@/features/guest/pay-result-screen";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export default async function PayResultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <GuestDocumentFonts className={guestFontClassName}>
      <Suspense>
        <PayResultScreen locale={locale as LocaleCode} />
      </Suspense>
    </GuestDocumentFonts>
  );
}
