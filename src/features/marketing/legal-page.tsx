import Link from "next/link";

import { landingPath } from "@/features/marketing/contact";
import type { LocaleCode } from "@/lib/i18n/locale-text";

type LegalDoc = { title: string; updated: string; intro: string; sections: { heading: string; body: string[] }[] };

const BACK = { en: "← Back to Qwicoo", ar: "→ العودة إلى كويكو" };
const SWITCH = { en: "العربية", ar: "English" };

export function LegalPage({ doc, locale, path }: { doc: LegalDoc; locale: LocaleCode; path: string }) {
  const other: LocaleCode = locale === "ar" ? "en" : "ar";
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className={`min-h-dvh bg-canvas text-ink ${locale === "ar" ? "font-arabic" : ""}`}>
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold">
          <Link href={landingPath(locale)} className="underline-offset-4 hover:underline">
            {BACK[locale]}
          </Link>
          <Link href={`${path}?lang=${other}`} hrefLang={other} className="underline-offset-4 hover:underline">
            {SWITCH[locale]}
          </Link>
        </div>
        <h1 className="mt-10 text-[clamp(32px,5vw,52px)] leading-tight font-bold">{doc.title}</h1>
        <p className="mt-2 text-sm text-quiet">{doc.updated}</p>
        <p className="mt-6 text-lg leading-relaxed">{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <ul className="mt-3 grid list-disc gap-2 ps-5 text-[15px] leading-relaxed text-quiet">
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
