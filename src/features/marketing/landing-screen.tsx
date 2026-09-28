import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  LayoutGrid,
  Monitor,
  QrCode,
  Receipt,
  Smartphone,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/ops/logo";
import { FEATURE_KEYS, SURFACE_KEYS, landingCopy, type FeatureKey, type SurfaceKey } from "@/features/marketing/copy";
import { formatMoney } from "@/lib/format/money";
import type { LocaleCode } from "@/lib/i18n/locale-text";

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
const EYEBROW = "text-sm font-medium text-muted-foreground";
const HEADING_2 = "text-[length:var(--text-28)] font-semibold sm:text-4xl";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const CTA_PRIMARY = `inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-elev-1 transition-colors hover:bg-primary/90 ${FOCUS}`;
const CTA_SECONDARY = `inline-flex min-h-12 items-center rounded-xl border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted ${FOCUS}`;

export function LandingScreen({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale];
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const display = isArabic ? "font-arabic" : "font-display";
  const otherLocale: LocaleCode = isArabic ? "en" : "ar";
  // Arabic ascenders and diacritics need more room than the Latin display face.
  const heading1 = `${display} ${isArabic ? "leading-[1.35]" : "leading-[1.1]"}`;
  const heading2 = `${HEADING_2} ${isArabic ? "leading-snug" : "leading-tight"}`;

  return (
    <div dir={dir} lang={locale} className={`bg-background text-foreground ${isArabic ? "font-arabic" : ""}`}>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 supports-backdrop-filter:bg-background/70 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={pathFor(locale)} aria-label="Qwicoo" className={`rounded-lg ${FOCUS}`}>
            <Logo markClassName="size-7 text-primary" wordClassName="text-xl" />
          </Link>

          <nav aria-label="Site" className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#features" className={`hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline-flex ${FOCUS}`}>
              {t.nav.features}
            </a>
            <a href="#partner" className={`hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline-flex ${FOCUS}`}>
              {t.nav.partner}
            </a>
            <Link
              href={pathFor(otherLocale)}
              hrefLang={otherLocale}
              aria-label={t.nav.languageLabel}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 font-medium transition-colors hover:bg-muted ${FOCUS}`}
            >
              {t.nav.language}
            </Link>
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center rounded-lg bg-primary px-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4 ${FOCUS}`}
            >
              <span className="sm:hidden">{t.footer.signInLabel}</span>
              <span className="hidden sm:inline">{t.nav.signIn}</span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_100%,var(--primary)_0%,transparent_70%)] opacity-15"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="grid gap-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-elev-1">
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              {t.hero.badge}
            </p>
            <h1 className={`${heading1} max-w-3xl text-[length:var(--text-40)] font-semibold sm:text-6xl`}>
              {t.hero.title}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{t.hero.body}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#partner" className={CTA_PRIMARY}>
                {t.hero.primary}
                <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
              </a>
              <a href="#problems" className={CTA_SECONDARY}>
                {t.hero.secondary}
              </a>
            </div>
          </div>

          <HeroPreview locale={locale} />
        </div>
      </section>

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
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
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
                className="grid gap-4 rounded-2xl border bg-card p-6 shadow-elev-1 transition-shadow hover:shadow-elev-2"
              >
                <div className="grid gap-2">
                  <h3 className="text-lg leading-snug font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
                <div className="flex gap-3 border-t pt-4">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
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
                  className="grid content-start gap-3 rounded-2xl border bg-background p-5 transition-colors hover:border-primary/40"
                >
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
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
                <span className="flex size-10 items-center justify-center rounded-full border bg-background text-sm font-semibold shadow-elev-1">
                  <span className="sr-only">{t.steps.stepLabel} </span>
                  {localeDigits(index + 1, locale)}
                </span>
                <h3 className="leading-snug font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-6 shadow-elev-1">
            <a href="mailto:partners@qwicoo.com?subject=Partner%20with%20Qwicoo" className={CTA_PRIMARY}>
              {t.steps.cta}
              <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </a>
            <p className="text-sm text-muted-foreground">{t.steps.note}</p>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid gap-2">
            <Logo markClassName="size-6 text-primary" wordClassName="text-lg" />

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
              className={`inline-flex min-h-11 items-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted ${FOCUS}`}
            >
              {t.footer.dashboard}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function pathFor(locale: LocaleCode): string {
  return locale === "ar" ? "/?lang=ar" : "/";
}

function localeDigits(value: number, locale: LocaleCode): string {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en");
}

/** Decorative composition of the three screens an order passes through. */
function HeroPreview({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].demo;

  return (
    <div aria-hidden className="relative isolate mx-auto w-full max-w-md lg:max-w-none">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-primary/10 blur-2xl" />

      <div className="grid gap-4">
        <article className="rounded-2xl border bg-card p-5 shadow-elev-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="size-4 text-muted-foreground" />
              {t.table}
            </p>
            <span className="rounded-full bg-[var(--status-ordered-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-ordered)]">
              {t.status}
            </span>
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
            {t.items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-border" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>{t.total}</span>
            <span>{formatMoney("124.50", "EGP", locale)}</span>
          </div>
        </article>

        <article className="me-auto w-[92%] rounded-2xl border bg-foreground p-5 text-background shadow-elev-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ChefHat className="size-4" />
              {t.station}
            </p>
            <span className="flex items-center gap-1 rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium">
              <Clock className="size-3" />
              {t.elapsed}
            </span>
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            {t.items.slice(0, 2).map((item) => (
              <li key={item} className="flex items-center gap-2 opacity-90">
                <span className="size-1.5 rounded-full bg-background/60" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-background/15 text-sm font-semibold">
            {t.bump}
          </p>
        </article>

        <p className="ms-auto flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-elev-1">
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--status-available-bg)] text-[var(--status-available)]">
            <Check className="size-3" />
          </span>
          {t.paid}
        </p>
      </div>
    </div>
  );
}
