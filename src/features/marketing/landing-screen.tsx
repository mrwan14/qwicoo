import Link from "next/link";
import {
  BarChart3,
  Check,
  ClipboardList,
  LayoutGrid,
  Monitor,
  QrCode,
  Receipt,
  Smartphone,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { LOGO_ASPECT, LOGO_VIDEO } from "@/components/brand/logo-assets";
import { FEATURE_KEYS, SURFACE_KEYS, landingCopy, type FeatureKey, type SurfaceKey } from "@/features/marketing/copy";
import { Hero } from "@/features/marketing/hero";
import { PartnerForm } from "@/features/marketing/partner-form";
import { PublicAssistantLauncher } from "@/features/marketing/public-assistant-launcher";
import { formatCount } from "@/lib/i18n/format";
import type { LocaleCode } from "@/lib/i18n/locale-text";

import "./landing.css";

const SURFACE_ICONS: Record<SurfaceKey, LucideIcon> = {
  guest: Smartphone,
  pos: Receipt,
  kds: Monitor,
  owner: BarChart3,
};

const FEATURE_ICONS: Record<FeatureKey, LucideIcon> = {
  qr: QrCode,
  pos: Receipt,
  kds: Monitor,
  floor: LayoutGrid,
  payments: Wallet,
  pickup: Truck,
  analytics: BarChart3,
  staff: ClipboardList,
};

const SECTION = "scroll-mt-20";
const EYEBROW = "text-sm font-medium text-quiet";
const HEADING_2 = "text-[length:var(--text-28)] font-semibold sm:text-4xl";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function LandingScreen({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale];
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const otherLocale: LocaleCode = isArabic ? "en" : "ar";
  const heading2 = `${HEADING_2} ${isArabic ? "leading-snug" : "leading-tight"}`;

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

      <section aria-label={t.surfaces.eyebrow} className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className={`${EYEBROW} mb-5`}>{t.surfaces.eyebrow}</p>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {SURFACE_KEYS.map((key) => {
              const Icon = SURFACE_ICONS[key];
              const item = t.surfaces.items[key];
              return (
                <li key={key} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="grid">
                    <span className="text-sm font-semibold">{item.title}</span>
                    <span className="text-sm text-muted-foreground">{item.body}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="problems" className={SECTION}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-2">
            <p className={EYEBROW}>{t.problems.eyebrow}</p>
            <h2 className={`${heading2} max-w-2xl`}>{t.problems.title}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {t.problems.items.map((item) => (
              <article
                key={item.title}
                className="grid gap-4 border bg-card p-6 shadow-elev-1 transition-shadow hover:shadow-elev-2"
              >
                <div className="grid gap-2">
                  <h3 className="text-lg leading-snug font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
                <div className="flex gap-3 border-t pt-4">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center bg-primary/10 text-primary"
                  >
                    <Check className="size-3" />
                  </span>
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold">{t.problems.fixLabel}: </span>
                    {item.fix}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className={`${SECTION} border-y bg-card`}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-2">
            <p className={EYEBROW}>{t.features.eyebrow}</p>
            <h2 className={`${heading2} max-w-2xl`}>{t.features.title}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_KEYS.map((key) => {
              const Icon = FEATURE_ICONS[key];
              const item = t.features.items[key];
              return (
                <article
                  key={key}
                  className="grid content-start gap-3 border bg-background p-5 transition-colors hover:border-primary/40"
                >
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="leading-snug font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="partner" className={SECTION}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-2">
            <p className={EYEBROW}>{t.steps.eyebrow}</p>
            <h2 className={`${heading2} max-w-2xl`}>{t.steps.title}</h2>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{t.steps.body}</p>
          </div>

          <ol className="relative grid gap-6 md:grid-cols-3 md:gap-8">
            <span aria-hidden className="absolute inset-x-0 top-5 hidden h-px bg-border md:block" />
            {t.steps.items.map((step, index) => (
              <li key={step.title} className="relative grid content-start gap-3">
                <span className="flex size-10 items-center justify-center border bg-background text-sm font-semibold shadow-elev-1">
                  <span className="sr-only">{t.steps.stepLabel} </span>
                  {localeDigits(index + 1, locale)}
                </span>
                <h3 className="leading-snug font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="grid gap-4">
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold">{t.steps.cta}</h3>
              <p className="text-sm text-muted-foreground">{t.steps.note}</p>
            </div>
            <PartnerForm locale={locale} />
          </div>
        </div>
      </section>

      <footer className="border-t bg-[#f2efe9]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_VIDEO.poster} alt="Qwicoo" className="-ms-2 block w-40 mix-blend-darken" style={{ aspectRatio: LOGO_ASPECT }} />

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Qwicoo · {t.footer.rights}
            </p>
            <nav aria-label={t.features.eyebrow} className="flex flex-wrap gap-4 text-sm sm:hidden">
              <a href="#features" className="underline-offset-4 hover:underline">
                {t.nav.features}
              </a>
              <a href="#partner" className="underline-offset-4 hover:underline">
                {t.nav.partner}
              </a>
            </nav>
          </div>
          <nav aria-label={t.footer.signInLabel} className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted ${FOCUS}`}
            >
              {t.footer.dashboard}
            </Link>
          </nav>
        </div>
      </footer>
      <PublicAssistantLauncher locale={locale} />
    </div>
  );
}

function pathFor(locale: LocaleCode): string {
  return locale === "ar" ? "/?lang=ar" : "/";
}

function localeDigits(value: number, locale: LocaleCode): string {
  return formatCount(value, locale);
}
