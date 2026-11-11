import type { Metadata } from "next";

import { privacyCopy } from "@/features/marketing/legal-copy";
import { LegalPage } from "@/features/marketing/legal-page";

type SearchParams = Promise<{ lang?: string | string[] }>;

async function pick(searchParams: SearchParams) {
  const { lang } = await searchParams;
  return (Array.isArray(lang) ? lang[0] : lang) === "en" ? "en" : "ar";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  return { title: privacyCopy[await pick(searchParams)].title };
}

export default async function PrivacyPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await pick(searchParams);
  return <LegalPage doc={privacyCopy[locale]} locale={locale} path="/privacy" />;
}
