"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { LOGO_ASPECT, LOGO_VIDEO } from "@/components/brand/logo-assets";
import { usePrefersReducedMotion } from "@/components/brand/animated-logo";
import { landingCopy } from "@/features/marketing/copy";
import { PartnerForm } from "@/features/marketing/partner-form";
import { PublicAssistantLauncher } from "@/features/marketing/public-assistant-launcher";
import { PublicAssistantProvider } from "@/features/marketing/public-assistant-session";
import { formatCount } from "@/lib/i18n/format";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const PublicChatPanel = dynamic(() => import("@/features/marketing/public-chat-panel").then((mod) => mod.PublicChatPanel), {
  ssr: false,
});

const STORY_KEYS = ["guest", "cashier", "kitchen", "owner"] as const;
const START_KEYS = ["talk", "setup", "print", "live"] as const;
const FACT_KEYS = [
  { key: "menu", count: 1, height: "46%" },
  { key: "languages", count: 2, height: "62%" },
  { key: "states", count: 3, height: "74%" },
  { key: "screens", count: 4, height: "88%" },
  { key: "pay", count: null, height: "100%" },
] as const;

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
      <Facts locale={locale} />
      <StartAccordion locale={locale} />
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

function Facts({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].facts;
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={`qw-stairs border-b border-qw-line bg-canvas px-[clamp(20px,5vw,72px)] py-20 ${active ? "qw-in" : ""}`}>
      <div className="mb-10 grid max-w-3xl gap-3">
        <p className="text-sm font-medium text-quiet">{t.eyebrow}</p>
        <h2 className="qw-display text-[clamp(36px,5vw,68px)]">{t.title}</h2>
        <p className="text-lg leading-relaxed text-quiet">{t.body}</p>
      </div>
      <div className="qw-stair">
        {FACT_KEYS.map((fact) => (
          <FactBar
            key={fact.key}
            locale={locale}
            count={fact.count}
            height={fact.height}
            title={t[fact.key].title}
            body={t[fact.key].body}
            active={active}
            reduced={reduced}
            mark={fact.key === "pay" ? "EGP" : null}
          />
        ))}
      </div>
    </section>
  );
}

function FactBar({
  locale,
  count,
  height,
  title,
  body,
  active,
  reduced,
  mark,
}: {
  locale: LocaleCode;
  count: number | null;
  height: string;
  title: string;
  body: string;
  active: boolean;
  reduced: boolean;
  mark: string | null;
}) {
  const shown = useCount(count, active, reduced);
  return (
    <div className="qw-stp border border-ink bg-canvas" style={{ ["--h" as string]: height }}>
      <p className="qw-display text-4xl" dir="ltr">
        {mark ?? formatCount(shown, locale)}
      </p>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="text-sm text-quiet">{body}</p>
    </div>
  );
}

function useCount(target: number | null, active: boolean, reduced: boolean): number {
  const [value, setValue] = useState(target ?? 0);
  useEffect(() => {
    if (target == null || !active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    setValue(0);
    let start: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      if (start == null) start = now;
      const progress = Math.min(1, (now - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, target]);
  return value;
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
        <div className="grid gap-6">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-quiet">{t.eyebrow}</p>
            <h2 className="qw-display text-[clamp(36px,5vw,64px)]">{t.title}</h2>
            <p className="max-w-xl text-lg leading-relaxed text-quiet">{t.body}</p>
          </div>
          <PartnerForm locale={locale} restaurantSeed={restaurant} />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-quiet">{t.askEyebrow}</p>
            <h2 className="qw-display text-[clamp(36px,5vw,64px)]">{t.askTitle}</h2>
            <p className="text-lg leading-relaxed text-quiet">{t.askBody}</p>
          </div>
          <div className="min-h-[36rem] border border-ink">
            <PublicChatPanel showClose={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].footer;
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink px-[clamp(20px,5vw,72px)] py-14 text-canvas">
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <span className="inline-block w-40 bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_VIDEO.poster} alt="Qwicoo" className="block w-full mix-blend-darken" style={{ aspectRatio: LOGO_ASPECT }} />
          </span>
          <p className="max-w-sm text-sm leading-6 text-canvas/80">{t.blurb}</p>
          <p className="text-sm text-canvas/70">{t.made}</p>
        </div>
        <FooterColumn title={t.product}>
          <a href="#offer">{t.qr}</a>
          <a href="#offer">{t.pos}</a>
          <a href="#flow">{t.kitchen}</a>
          <a href="#flow">{t.drive}</a>
        </FooterColumn>
        <FooterColumn title={t.company}>
          <a href="#partner">{landingCopy[locale].nav.partner}</a>
          <a href="#partner">{t.contact}</a>
          <Link href="/login">{t.dashboard}</Link>
        </FooterColumn>
        <FooterColumn title={t.language}>
          <Link href="/" hrefLang="en">
            English
          </Link>
          <Link href="/?lang=ar" hrefLang="ar">
            العربية
          </Link>
        </FooterColumn>
      </div>
      <p className="mt-10 text-sm text-canvas/60" dir="ltr">
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
