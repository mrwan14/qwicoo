import type { Metadata } from "next";

import { landingCopy } from "@/features/marketing/copy";
import { LandingScreen } from "@/features/marketing/landing-screen";
import { RememberLocale } from "@/lib/i18n/locale-sync";
import type { LocaleCode } from "@/lib/i18n/locale-text";

type SearchParams = Promise<{ lang?: string | string[] }>;

function pickLandingLocale(value: string | string[] | undefined): LocaleCode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "ar" ? "ar" : "en";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = pickLandingLocale((await searchParams).lang);
  const { meta } = landingCopy[locale];

  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: locale === "ar" ? "/?lang=ar" : "/", languages: { en: "/", ar: "/?lang=ar" } },
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const locale = pickLandingLocale((await searchParams).lang);

  return (
    <main>
      <RememberLocale locale={locale} />
      <LandingScreen locale={locale} />
    </main>
  );
}
