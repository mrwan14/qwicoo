"use client";

import { AnimatedLogo, usePrefersReducedMotion } from "@/components/brand/animated-logo";
import { landingCopy } from "@/features/marketing/copy";
import { withoutMotion } from "@/features/marketing/motion";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const TICKET_KEYS = ["drive", "table7", "table12", "qr", "pos", "pickup", "table9"] as const;

const CHIP_TONE = {
  newOrder: "bg-signal-new",
  ready: "bg-signal-done",
  paid: "bg-signal-done",
  grill: "bg-signal-wip",
} as const;

const TICKET_TONE = {
  drive: "new",
  table7: "cook",
  table12: "ready",
  qr: "new",
  pos: "cook",
  pickup: "ready",
  table9: "new",
} as const;

export function Hero({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].hero;
  const reduced = usePrefersReducedMotion();
  const tickets = reduced ? TICKET_KEYS : [...TICKET_KEYS, ...TICKET_KEYS];

  return (
    <section data-hero className="relative grid min-h-[calc(100dvh-68px)] grid-rows-[1fr_auto] overflow-hidden border-b border-qw-line bg-canvas">
      <div aria-hidden className="qw-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="relative grid place-items-center px-5 py-14 text-center sm:py-16">
        <Chip
          className={withoutMotion(reduced, "qw-chip qw-drift top-[12%] start-[7%] max-[900px]:top-[3%] max-[900px]:start-[4%] [animation-delay:-1s]")}
          tone={CHIP_TONE.newOrder}
          label={t.chips.newOrder.label}
          detail={t.chips.newOrder.detail}
        />
        <Chip
          className={withoutMotion(
            reduced,
            "qw-chip qw-drift top-[20%] end-[7%] max-[900px]:top-auto max-[900px]:bottom-[6%] max-[900px]:end-[4%] [animation-delay:-3s]",
          )}
          tone={CHIP_TONE.ready}
          label={t.chips.ready.label}
          detail={t.chips.ready.detail}
        />
        <Chip
          className={withoutMotion(reduced, "qw-chip qw-chip-wide qw-drift bottom-[16%] start-[9%] [animation-delay:-5s]")}
          tone={CHIP_TONE.paid}
          label={t.chips.paid.label}
          detail={t.chips.paid.detail}
          dark
        />
        <Chip
          className={withoutMotion(reduced, "qw-chip qw-chip-wide qw-drift bottom-[22%] end-[9%] [animation-delay:-2s]")}
          tone={CHIP_TONE.grill}
          label={t.chips.grill.label}
          detail={t.chips.grill.detail}
        />

        <div className="relative z-[1] mx-auto w-[min(720px,80vw)]">
          <AnimatedLogo />
        </div>
        <h1 className="relative z-[1] mx-auto mt-8 max-w-[740px] text-[clamp(20px,2.1vw,29px)] leading-snug font-medium text-ink">
          {t.titleLead} <b className="font-semibold text-signal-new">{t.titleNew}</b> {t.titleTo}{" "}
          <b className="font-semibold text-[var(--cooking-text)]">{t.titleCooking}</b> {t.titleTo}{" "}
          <b className="font-semibold text-sage-deep">{t.titleReady}</b> {t.titleTail}
        </h1>
        <div className="relative z-[1] mt-8 flex flex-wrap justify-center gap-3">
          <a href="#partner" className={`inline-flex min-h-[52px] items-center bg-ink px-6 text-[15px] font-semibold text-canvas ${FOCUS}`}>
            {t.primary}
          </a>
          <a
            href="#partner"
            className={`inline-flex min-h-[52px] items-center border-2 border-ink bg-transparent px-6 text-[15px] font-semibold text-ink ${FOCUS}`}
          >
            {t.ask}
          </a>
        </div>
        <ul className="relative z-[1] mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-quiet">
          <Signal swatch="bg-signal-new" label={t.signals.new} />
          <Signal swatch="bg-signal-wip" label={t.signals.cooking} />
          <Signal swatch="bg-signal-done" label={t.signals.ready} />
          <li>{t.signals.languages}</li>
          <li>{t.signals.prices}</li>
        </ul>
      </div>

      <div className="relative z-[1] overflow-hidden border-t border-qw-line bg-white">
        <div className={withoutMotion(reduced, "qw-strip-in flex w-max gap-3 py-4")}>
          {tickets.map((key, index) => (
            <Ticket key={`${key}-${index}`} locale={locale} ticketKey={key} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Signal({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      <i aria-hidden className={`inline-block size-2.5 ${swatch}`} />
      {label}
    </li>
  );
}

function Chip({
  className,
  tone,
  label,
  detail,
  dark = false,
}: {
  className: string;
  tone: string;
  label: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <p
      className={`absolute z-[2] items-center gap-2.5 border border-ink px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap max-[900px]:px-2 max-[900px]:py-1.5 max-[900px]:text-[11px] max-[900px]:shadow-[4px_4px_0_var(--ink)] ${dark ? "bg-ink text-canvas shadow-[6px_6px_0_var(--sage)]" : "bg-white text-ink shadow-[6px_6px_0_var(--ink)]"} ${className}`}
    >
      <i aria-hidden className={`inline-block size-3 ${tone}`} />
      <Mixed>{label}</Mixed>
      <small className={`font-medium ${dark ? "text-[#bdb5ab]" : "text-quiet"}`}>
        <Mixed>{detail}</Mixed>
      </small>
    </p>
  );
}

function Ticket({ locale, ticketKey }: { locale: LocaleCode; ticketKey: (typeof TICKET_KEYS)[number] }) {
  const ticket = landingCopy[locale].hero.tickets[ticketKey];
  const tone = TICKET_TONE[ticketKey];
  const edge = tone === "cook" ? "var(--amber)" : tone === "ready" ? "var(--sage)" : "var(--orange)";
  const badge =
    tone === "cook" ? "bg-signal-wip text-ink" : tone === "ready" ? "bg-signal-done text-white" : "bg-signal-new text-white";

  return (
    <article
      className="w-[230px] shrink-0 border border-qw-line border-s-[6px] bg-white px-3 py-2.5 text-[13px] text-ink"
      style={{ borderInlineStartColor: edge }}
    >
      <h3 className="mb-2 flex items-center justify-between gap-2 text-[13px] font-semibold">
        <Mixed>{ticket.heading}</Mixed>
        <span className={`px-2 py-1 text-[11px] font-bold tracking-wide uppercase ${badge}`}>
          <Mixed>{ticket.badge}</Mixed>
        </span>
      </h3>
      <p>{ticket.item}</p>
    </article>
  );
}

function Mixed({ children }: { children: string }) {
  const isolate = /EGP|^\s*#|\d:\d{2}/.test(children);
  if (!isolate) return children;
  return (
    <span dir="ltr" className="inline-block">
      {children}
    </span>
  );
}
