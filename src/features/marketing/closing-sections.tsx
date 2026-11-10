"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Check, Mail, MessageCircle, Phone, Plus } from "lucide-react";

import { LOGO_ASPECT, LOGO_VIDEO } from "@/components/brand/logo-assets";
import { usePrefersReducedMotion } from "@/components/brand/animated-logo";
import { CONTACT, OPEN_ASSISTANT_EVENT, whatsappHref } from "@/features/marketing/contact";
import { landingCopy } from "@/features/marketing/copy";
import { PartnerForm } from "@/features/marketing/partner-form";
import { PublicAssistantLauncher } from "@/features/marketing/public-assistant-launcher";
import { PublicAssistantProvider } from "@/features/marketing/public-assistant-session";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const PublicChatPanel = dynamic(() => import("@/features/marketing/public-chat-panel").then((mod) => mod.PublicChatPanel), {
  ssr: false,
});

const STORY_KEYS = ["guest", "cashier", "kitchen", "owner"] as const;
const START_KEYS = ["talk", "setup", "print", "live"] as const;
const ROLE_COLOR = {
  guest: "var(--orange)",
  cashier: "var(--amber)",
  kitchen: "var(--sage)",
  owner: "var(--canvas)",
} as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ClosingSections({ locale }: { locale: LocaleCode }) {
  const [restaurant, setRestaurant] = useState("");

  return (
    <PublicAssistantProvider locale={locale}>
      <RoleStory locale={locale} />
      <Pricing locale={locale} />
      <StartAccordion locale={locale} />
      <Faq locale={locale} />
      <CallToAction locale={locale} onRestaurant={setRestaurant} />
      <PartnerBand locale={locale} restaurant={restaurant} />
      <SiteFooter locale={locale} />
      <PublicAssistantLauncher locale={locale} />
    </PublicAssistantProvider>
  );
}

function RoleStory({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].story;
  const scan = landingCopy[locale].scan;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const span = node.offsetHeight - window.innerHeight;
      const progress = span <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / span));
      setIndex(Math.min(STORY_KEYS.length - 1, Math.floor(progress * STORY_KEYS.length * 0.999)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function jump(next: number) {
    const node = ref.current;
    if (!node) return;
    const span = node.offsetHeight - window.innerHeight;
    const top = window.scrollY + node.getBoundingClientRect().top + (span * next) / (STORY_KEYS.length - 1);
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <section ref={ref} className="qw-story">
      <div className="qw-story-pin">
        <div className="mb-6 flex flex-wrap gap-2" role="tablist">
          {STORY_KEYS.map((key, item) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={item === index}
              className={`min-h-10 border px-3 text-sm ${item === index ? "border-canvas bg-canvas text-ink" : "border-canvas/30 text-canvas"} ${FOCUS}`}
              onClick={() => jump(item)}
            >
              {t[key].tab}
            </button>
          ))}
        </div>
        {STORY_KEYS.map((key, item) => (
          <div key={key} className={item === index ? "qw-frame qw-on" : "qw-frame"}>
            <div className="grid content-start gap-4">
              <p className="text-sm text-canvas/70" dir="ltr">
                {t[key].kicker}
              </p>
              <h2 className="qw-display text-[clamp(36px,5vw,68px)]">{t[key].title}</h2>
              <p className="max-w-xl text-lg leading-relaxed text-canvas/80">{t[key].body}</p>
              <div className="grid w-fit gap-1 border border-canvas/30 px-4 py-3" style={{ borderInlineStartWidth: 6, borderInlineStartColor: ROLE_COLOR[key] }}>
                <p className="qw-display text-3xl" dir="ltr">
                  {t[key].stat}
                </p>
                <p className="text-sm text-canvas/70">{t[key].statNote}</p>
              </div>
            </div>
            <RoleScreen locale={locale} kind={key} scanPlace={scan.place} dishes={[scan.dishes.grill, scan.dishes.soup]} />
          </div>
        ))}
        <div className="mt-6 h-1 bg-canvas/20" aria-hidden>
          <div className="h-full bg-[var(--orange)]" style={{ width: `${((index + 1) / STORY_KEYS.length) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

function RoleScreen({
  locale,
  kind,
  scanPlace,
  dishes,
}: {
  locale: LocaleCode;
  kind: (typeof STORY_KEYS)[number];
  scanPlace: string;
  dishes: { name: string; price: string }[];
}) {
  const t = landingCopy[locale].story;
  if (kind === "guest") {
    return (
      <div className="mx-auto grid w-[min(280px,100%)] gap-3 border border-canvas/30 bg-[#1c1c1c] p-4 text-canvas">
        <p className="text-sm font-semibold">{scanPlace}</p>
        {dishes.map((dish) => (
          <div key={dish.name} className="flex items-baseline justify-between gap-3 border-t border-canvas/20 pt-2 text-sm">
            <span>{dish.name}</span>
            <span dir="ltr">{dish.price}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "cashier") {
    return (
      <div className="grid gap-3 border border-canvas/30 bg-[#1c1c1c] p-4 text-canvas">
        {t.cashierItems.map((item) => (
          <div key={item.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{item.name}</span>
            <span dir="ltr">{item.price}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-canvas/20 pt-3">
          <span className="text-sm">{t.cashier.tab}</span>
          <span className="qw-display text-2xl" dir="ltr">
            {t.cashierTotal}
          </span>
        </div>
        <p className="text-sm text-canvas/70">{t.cashierMethods}</p>
      </div>
    );
  }
  if (kind === "kitchen") {
    const columns = [t.kitchenNew, t.kitchenCook, t.kitchenReady];
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {t.kitchenTickets.map((ticket, item) => (
          <div key={ticket.code} className="grid gap-2 border border-canvas/30 bg-[#1c1c1c] p-3 text-canvas">
            <p className="text-xs uppercase tracking-wide text-canvas/60">{columns[item]}</p>
            <p className="text-sm font-semibold" dir="ltr">
              {ticket.code}
            </p>
            <p className="text-sm">{ticket.item}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 border border-canvas/30 bg-[#1c1c1c] p-4 text-canvas">
      <p className="text-xs uppercase tracking-wide text-canvas/60">{t.ownerSample}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-canvas/70">{t.ownerSalesLabel}</p>
          <p className="qw-display text-3xl" dir="ltr">
            {t.ownerSales}
          </p>
        </div>
        <div>
          <p className="text-sm text-canvas/70">{t.ownerOrdersLabel}</p>
          <p className="qw-display text-3xl" dir="ltr">
            {t.ownerOrders}
          </p>
        </div>
      </div>
    </div>
  );
}

function StartAccordion({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].start;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || locked) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearInterval(timer);
        if (!entry?.isIntersecting) return;
        timer = window.setInterval(() => setOpen((current) => (current + 1) % START_KEYS.length), 3200);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reduced, locked]);

  const current = START_KEYS[open] ?? "talk";

  return (
    <section id="start" ref={ref} className="scroll-mt-20 border-b border-qw-line bg-white px-[clamp(20px,5vw,72px)] py-20">
      <div className="grid items-start gap-10 min-[900px]:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="qw-display pointer-events-none mb-4 text-7xl text-ink/10">{t.ghost}</p>
          <p className="text-sm font-medium text-quiet">{t.eyebrow}</p>
          <h2 className="qw-display mt-2 text-[clamp(36px,5vw,68px)]">{t.title}</h2>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-quiet">{t.body}</p>
          <div className="mt-8 border-t border-qw-line">
            {START_KEYS.map((key, item) => {
              const step = t[key];
              const selected = item === open;
              return (
                <div key={key} className="border-b border-qw-line">
                  <button
                    type="button"
                    aria-expanded={selected}
                    className={`flex w-full items-baseline gap-4 py-4 text-start ${FOCUS}`}
                    onClick={() => {
                      setLocked(true);
                      setOpen(item);
                    }}
                  >
                    <span className="qw-display text-sm" dir="ltr">
                      {String(item + 1).padStart(2, "0")}
                    </span>
                    <span className="text-lg font-semibold">{step.title}</span>
                  </button>
                  {selected ? <p className="pb-4 ps-10 text-sm leading-6 text-quiet">{step.body}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="qw-acc-vis border border-ink bg-canvas p-5">
          <StartVisual kind={current} lines={t[current].lines} />
        </div>
      </div>
    </section>
  );
}

function StartVisual({ kind, lines }: { kind: (typeof START_KEYS)[number]; lines: string[] }) {
  if (kind === "talk") {
    return (
      <div className="grid gap-3">
        <p className="bg-ink px-3 py-3 text-sm text-canvas">{lines[0]}</p>
        <p className="border border-qw-line px-3 py-3 text-sm">{lines[1]}</p>
      </div>
    );
  }
  if (kind === "print") {
    return (
      <div className="grid grid-cols-3 gap-3">
        {lines.map((line) => (
          <div key={line} className="grid h-28 place-items-center border border-ink text-sm font-semibold">
            {line}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "live") {
    return (
      <div className="grid gap-2 border border-ink p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sage-deep)]">{lines[0]}</p>
        <p className="text-sm text-quiet">{lines[1]}</p>
        <p className="text-sm font-semibold" dir="ltr">
          {lines[2]}
        </p>
        <p className="text-sm">{lines[3]}</p>
        <p className="text-sm">{lines[4]}</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-2">
      {lines.map((line) => (
        <li key={line} className="border border-qw-line px-3 py-2 text-sm">
          {line}
        </li>
      ))}
    </ul>
  );
}

function Pricing({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].pricing;
  return (
    <section id="pricing" className="scroll-mt-20 border-b border-qw-line bg-white px-[clamp(20px,5vw,72px)] py-20">
      <div className="grid max-w-3xl gap-3">
        <p className="text-xs font-bold tracking-[0.14em] text-sage-deep uppercase">{t.eyebrow}</p>
        <h2 className="qw-display text-[clamp(34px,4.4vw,64px)]">{t.title}</h2>
        <p className="text-lg leading-relaxed text-quiet">{t.body}</p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.tiers.map((tier, index) => {
          const featured = index === 1;
          const custom = !/\d/.test(tier.price);
          return (
            <div
              key={tier.name}
              className={`relative grid content-start gap-3 border-2 p-6 pt-7 ${featured ? "border-ink bg-ink text-canvas" : "border-qw-line bg-canvas"}`}
            >
              {featured ? (
                <span className="absolute -top-3 start-5 inline-flex bg-[var(--orange)] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                  {t.popular}
                </span>
              ) : null}
              <p className="text-sm font-semibold">{tier.name}</p>
              <p className="flex items-baseline gap-2">
                <span className="qw-display text-[44px] leading-none" dir={custom ? undefined : "ltr"}>
                  {tier.price}
                </span>
                {custom ? null : <span className={`text-sm font-semibold ${featured ? "text-canvas/70" : "text-quiet"}`}>{t.currency}</span>}
              </p>
              <p className={`text-sm ${featured ? "text-canvas/75" : "text-quiet"}`}>{tier.note}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="qw-bx border border-qw-line bg-canvas p-6">
          <p className="font-semibold">{t.includesTitle}</p>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {t.includes.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[15px]">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sage-deep" />
                {line}
              </li>
            ))}
          </ul>
          <ul className="mt-5 grid gap-2 border-t border-qw-line pt-5 text-sm text-quiet">
            {t.terms.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="qw-bx grid content-start gap-3 bg-[var(--orange)] p-6 text-white">
          <span className="inline-flex w-fit bg-white px-3 py-1 text-[11px] font-bold tracking-wide text-ink uppercase">{t.founding.badge}</span>
          <h3 className="qw-display text-[clamp(26px,2.6vw,36px)] leading-tight">{t.founding.title}</h3>
          <p className="text-[15px] leading-relaxed text-white/90">{t.founding.body}</p>
          <p className="text-sm font-semibold">{t.founding.limited}</p>
          <a href="#partner" className={`mt-2 inline-flex min-h-12 w-fit items-center bg-ink px-5 text-sm font-semibold text-canvas ${FOCUS}`}>
            {t.founding.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

function Faq({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].faq;
  return (
    <section id="faq" className="scroll-mt-20 border-b border-qw-line bg-canvas px-[clamp(20px,5vw,72px)] py-20">
      <div className="grid gap-10 min-[900px]:grid-cols-[0.8fr_1.2fr]">
        <div className="grid content-start gap-3">
          <p className="text-xs font-bold tracking-[0.14em] text-sage-deep uppercase">{t.eyebrow}</p>
          <h2 className="qw-display text-[clamp(34px,4.4vw,64px)]">{t.title}</h2>
        </div>
        <div className="border-t border-ink">
          {t.items.map((item) => (
            <details key={item.q} className="group border-b border-ink">
              <summary className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                {item.q}
                <Plus aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-45" />
              </summary>
              <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-quiet">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToAction({ locale, onRestaurant }: { locale: LocaleCode; onRestaurant: (value: string) => void }) {
  const t = landingCopy[locale].cta;
  const reduced = usePrefersReducedMotion();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("restaurant") ?? "").trim();
    if (value) onRestaurant(value);
    document.getElementById("partner")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <section className="bg-[var(--orange)] px-[clamp(20px,5vw,72px)] py-16 text-ink">
      <form className="grid gap-6" onSubmit={submit}>
        <h2 className="qw-display max-w-4xl text-[clamp(40px,6vw,84px)]">{t.title}</h2>
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="qw-restaurant">
            {t.placeholder}
          </label>
          <input id="qw-restaurant" name="restaurant" placeholder={t.placeholder} className="h-14 min-w-0 flex-1 border-2 border-ink bg-canvas px-4 text-base" />
          <button type="submit" className={`h-14 bg-ink px-6 text-sm font-semibold text-canvas ${FOCUS}`}>
            {t.button}
          </button>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <li>{t.branch}</li>
          <li>{t.menu}</li>
          <li>{t.languages}</li>
        </ul>
      </form>
    </section>
  );
}

function PartnerBand({ locale, restaurant }: { locale: LocaleCode; restaurant: string }) {
  const t = landingCopy[locale].partner;
  return (
    <section id="partner" className="scroll-mt-20 border-b border-qw-line bg-white px-[clamp(20px,5vw,72px)] py-20">
      <div className="grid items-start gap-12 min-[900px]:grid-cols-2">
        <div className="grid min-w-0 gap-6">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-quiet">{t.eyebrow}</p>
            <h2 className="qw-display text-[clamp(36px,5vw,64px)]">{t.title}</h2>
            <p className="max-w-xl text-lg leading-relaxed text-quiet">{t.body}</p>
          </div>
          <PartnerForm locale={locale} restaurantSeed={restaurant} />
          <ContactCard locale={locale} />
        </div>
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-quiet">{t.askEyebrow}</p>
            <h2 className="qw-display text-[clamp(36px,5vw,64px)]">{t.askTitle}</h2>
            <p className="text-lg leading-relaxed text-quiet">{t.askBody}</p>
          </div>
          <InlineChat label={t.askOpen} />
        </div>
      </div>
    </section>
  );
}

function ContactCard({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].partner;
  const row = `flex min-h-12 items-center gap-3 border border-qw-line bg-white px-4 text-[15px] font-semibold ${FOCUS}`;
  return (
    <div className="grid gap-3 border-2 border-ink bg-canvas p-6">
      <div>
        <h3 className="text-lg font-semibold">{t.talkTitle}</h3>
        <p className="mt-1 text-sm text-quiet">{t.talkBody}</p>
      </div>
      <a href={whatsappHref(t.waMessage)} target="_blank" rel="noopener noreferrer" className={`${row} border-[#1f7a4d] bg-[#1f7a4d] text-white`}>
        <MessageCircle aria-hidden className="size-5" />
        {t.whatsapp}
        <span className="ms-auto font-medium" dir="ltr">
          {CONTACT.phoneDisplay}
        </span>
      </a>
      <a href={CONTACT.phoneHref} className={row}>
        <Phone aria-hidden className="size-5" />
        {t.call}
        <span className="ms-auto font-medium" dir="ltr">
          {CONTACT.phoneDisplay}
        </span>
      </a>
      <a href={`mailto:${CONTACT.email}`} className={`${row} min-w-0`}>
        <Mail aria-hidden className="size-5 shrink-0" />
        <span className="shrink-0">{t.email}</span>
        <span className="ms-auto min-w-0 truncate font-medium" dir="ltr">
          {CONTACT.email}
        </span>
      </a>
    </div>
  );
}

/** The chat bundle loads when the panel comes near the screen, not with the page. */
function InlineChat({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div ref={ref} className="qw-chat h-[36rem] overflow-hidden rounded-[24px] shadow-[0_18px_50px_rgb(0_0_0/0.10)] ring-1 ring-qw-line">
      {near ? (
        <PublicChatPanel showClose={false} />
      ) : (
        <div className="grid h-full place-items-center bg-white">
          <button
            type="button"
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas"
            onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}

function SiteFooter({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].footer;
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink px-[clamp(20px,5vw,72px)] pt-14 pb-28 text-canvas">
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          {/* The only logo file sits on a light canvas. Inverting it (and turning the hue back) makes
              the canvas near-black and the letters light; `lighten` then lets the footer show through. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_VIDEO.poster}
            alt="Qwicoo"
            className="qw-footer-logo block w-40 invert hue-rotate-180 mix-blend-lighten"
            style={{ aspectRatio: LOGO_ASPECT }}
          />
          <p className="max-w-sm text-sm leading-6 text-canvas/80">{t.blurb}</p>
          <p className="text-sm text-canvas/70">{t.made}</p>
        </div>
        <FooterColumn title={t.product}>
          <a href="#offer">{t.qr}</a>
          <a href="#flow">{t.kitchen}</a>
          <a href="#back-office">{t.backOffice}</a>
          <a href="#pricing">{t.pricing}</a>
          <a href="#faq">{t.faq}</a>
        </FooterColumn>
        <FooterColumn title={t.company}>
          <a href="#partner">{landingCopy[locale].nav.partner}</a>
          <a href={whatsappHref(landingCopy[locale].partner.waMessage)} target="_blank" rel="noopener noreferrer" className="gap-1.5">
            {t.whatsapp}
            <span aria-hidden>·</span>
            <span dir="ltr">{CONTACT.phoneDisplay}</span>
          </a>
          <a href={`mailto:${CONTACT.email}`} dir="ltr" className="break-all">
            {CONTACT.email}
          </a>
          <Link href="/login">{t.dashboard}</Link>
        </FooterColumn>
        <FooterColumn title={t.language}>
          <Link href="/?lang=en" hrefLang="en">
            English
          </Link>
          <Link href="/?lang=ar" hrefLang="ar">
            العربية
          </Link>
          <Link href={`/privacy?lang=${locale}`}>{t.privacy}</Link>
          <Link href={`/terms?lang=${locale}`}>{t.terms}</Link>
        </FooterColumn>
      </div>
      <p className="mt-10 text-sm text-canvas/60">
        © {year} Qwicoo · {t.rights}
      </p>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="grid content-start gap-2 text-sm" aria-label={title}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-canvas/50">{title}</p>
      <div className="grid gap-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">{children}</div>
    </nav>
  );
}
