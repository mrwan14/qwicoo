import dynamic from "next/dynamic";
import Link from "next/link";

import { LOGO_ASPECT, LOGO_VIDEO } from "@/components/brand/logo-assets";
import { landingCopy } from "@/features/marketing/copy";
import { Hero } from "@/features/marketing/hero";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const StorySections = dynamic(() => import("@/features/marketing/story-sections").then((mod) => mod.StorySections));
const ClosingSections = dynamic(() => import("@/features/marketing/closing-sections").then((mod) => mod.ClosingSections));

import "./landing.css";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function LandingScreen({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale];
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const otherLocale: LocaleCode = isArabic ? "en" : "ar";

  return (
    <div dir={dir} lang={locale} className={`qw-landing bg-white text-ink ${isArabic ? "font-arabic" : ""}`}>
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-qw-line bg-canvas px-[clamp(20px,5vw,72px)]">
        <Link href={pathFor(locale)} aria-label="Qwicoo" className={`block shrink-0 ${FOCUS}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_VIDEO.poster} alt="" className="block h-8 w-auto mix-blend-darken" style={{ aspectRatio: LOGO_ASPECT }} />
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-7 text-sm text-quiet min-[901px]:flex">
          <a href="#offer" className={FOCUS}>
            {t.nav.offer}
          </a>
          <a href="#flow" className={FOCUS}>
            {t.nav.flow}
          </a>
          <a href="#start" className={FOCUS}>
            {t.nav.start}
          </a>
          <a href="#partner" className={FOCUS}>
            {t.nav.partners}
          </a>
        </nav>
        <div className="flex items-center gap-3.5 text-sm">
          <Link
            href={pathFor(otherLocale)}
            hrefLang={otherLocale}
            aria-label={t.nav.languageLabel}
            className={`font-semibold ${isArabic ? "font-sans" : "font-arabic"} ${FOCUS}`}
          >
            {t.nav.language}
          </Link>
          <Link href="/login" className={`hidden min-[901px]:inline-flex ${FOCUS}`}>
            {t.nav.signIn}
          </Link>
          <a href="#partner" className={`inline-flex min-h-10 items-center bg-ink px-4 text-sm font-semibold text-canvas ${FOCUS}`}>
            {t.nav.partner}
          </a>
        </div>
      </header>
      <Hero locale={locale} />
      <StorySections locale={locale} />
      <ClosingSections locale={locale} />
    </div>
  );
}

function pathFor(locale: LocaleCode): string {
  return locale === "ar" ? "/?lang=ar" : "/";
}
