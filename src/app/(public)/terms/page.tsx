import type { Metadata } from "next";

import { termsCopy } from "@/features/marketing/legal-copy";
import { LegalPage } from "@/features/marketing/legal-page";

type SearchParams = Promise<{ lang?: string | string[] }>;

async function pick(searchParams: SearchParams) {
  const { lang } = await searchParams;
  return (Array.isArray(lang) ? lang[0] : lang) === "en" ? "en" : "ar";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  return { title: termsCopy[await pick(searchParams)].title };
}

export default async function TermsPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await pick(searchParams);
  return <LegalPage doc={termsCopy[locale]} locale={locale} path="/terms" />;
}
