import type { Metadata } from "next";
import { headers } from "next/headers";

import { landingCopy } from "@/features/marketing/copy";
import { pickLandingLocale } from "@/features/marketing/landing-locale";
import { LandingScreen } from "@/features/marketing/landing-screen";
import { RememberLocale } from "@/lib/i18n/locale-sync";

type SearchParams = Promise<{ lang?: string | string[] }>;

async function landingLocale(searchParams: SearchParams) {
  const [{ lang }, requestHeaders] = await Promise.all([searchParams, headers()]);
  return pickLandingLocale(lang, requestHeaders.get("accept-language"));
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await landingLocale(searchParams);
  const { meta } = landingCopy[locale];

  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: {
      canonical: `/?lang=${locale}`,
      languages: { ar: "/?lang=ar", en: "/?lang=en", "x-default": "/" },
    },
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await landingLocale(searchParams);

  return (
    <main>
      <RememberLocale locale={locale} />
      <LandingScreen locale={locale} />
    </main>
  );
}
