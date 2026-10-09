"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { usePrefersReducedMotion } from "@/components/brand/animated-logo";
import { FLOW_KEYS, SWAP_KEYS, landingCopy, type FlowKey, type SwapKey } from "@/features/marketing/copy";
import { withoutMotion } from "@/features/marketing/motion";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const SPOKES = [
  "M600,320 Q409,163 168,109",
  "M600,320 Q632,186 600,51",
  "M600,320 Q841,266 1032,109",
  "M600,320 Q846,379 1092,320",
  "M600,320 Q791,477 1032,531",
  "M600,320 Q568,454 600,589",
  "M600,320 Q359,374 168,531",
  "M600,320 Q354,261 108,320",
];

const NODE_POS: Record<FlowKey, { left: string; top: string; color: string }> = {
  guest: { left: "14%", top: "17%", color: "var(--orange)" },
  kitchen: { left: "50%", top: "8%", color: "var(--amber)" },
  expo: { left: "86%", top: "17%", color: "var(--sage)" },
  owner: { left: "89%", top: "50%", color: "var(--ink)" },
  floor: { left: "86%", top: "83%", color: "var(--sage)" },
  pay: { left: "50%", top: "92%", color: "var(--sage)" },
  pos: { left: "14%", top: "83%", color: "var(--amber)" },
  drive: { left: "11%", top: "50%", color: "var(--orange)" },
};

const WORD_COLOR: Record<SwapKey, string> = {
  tables: "text-signal-new",
  kitchen: "text-[var(--cooking-text)]",
  drive: "text-sage-deep",
  branches: "text-ink",
};

const KICKER: Record<SwapKey, string> = {
  tables: "bg-signal-new text-white",
  kitchen: "bg-signal-wip text-ink",
  drive: "bg-sage-deep text-white",
  branches: "bg-ink text-canvas",
};

const TABLES = ["o", "", "a", "s", "", "o", "a", "", "s", "", "a", "s"] as const;

export function StorySections({ locale }: { locale: LocaleCode }) {
  return (
    <>
      <Swap locale={locale} />
      <Scan locale={locale} />
      <Bento locale={locale} />
      <Hub locale={locale} />
    </>
  );
}

function Swap({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].swap;
  const reduced = usePrefersReducedMotion();
  const { ref, progress } = useScrollProgress(reduced);
  const index = Math.min(SWAP_KEYS.length - 1, Math.floor(progress * SWAP_KEYS.length * 0.999));

  return (
    <section ref={ref} className="qw-swap relative border-b border-qw-line bg-white">
      <div className="qw-swap-sticky qw-wrap">
        <h2 className="qw-display m-0 text-[clamp(46px,6.2vw,104px)] max-[900px]:text-[44px]">
          <span className="block text-[#b9b0a5]">
            {t.line1}
            <br />
            {t.line2}
          </span>
          <span className="qw-words">
            {SWAP_KEYS.map((key, item) => (
              <span key={key} className={`${WORD_COLOR[key]} ${item === index ? "qw-on" : item < index ? "qw-out" : ""}`}>
                {t.words[key]}
              </span>
            ))}
          </span>
        </h2>
        <ol className="grid border-t-2 border-ink">
          {SWAP_KEYS.map((key, item) => (
            <li key={key} className={`qw-side-item grid grid-cols-[44px_1fr] gap-3 border-b border-qw-line py-[18px] max-[900px]:py-2.5 ${item === index ? "qw-on" : ""}`}>
              <span className={`qw-display grid size-11 place-items-center text-sm ${KICKER[key]}`}>{String(item + 1).padStart(2, "0")}</span>
              <span>
                <b className="block text-lg">{t.items[key].title}</b>
                <p className="m-0 mt-0.5 text-[15px] text-quiet max-[900px]:text-[13px]">{t.items[key].body}</p>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className={withoutMotion(reduced, "qw-bar")} style={{ width: `${(reduced ? 1 : progress) * 100}%` }} />
    </section>
  );
}

function Scan({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].scan;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const center = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const dx = Math.max(-1, Math.min(1, center)) * 60;
      const rtl = document.documentElement.dir === "rtl" || el.closest("[dir=rtl]") ? -1 : 1;
      setShift(dx * rtl);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  const dishes = [t.dishes.grill, t.dishes.soup, t.dishes.drink, t.dishes.dessert];
  const tones = ["bg-[var(--orange)]", "bg-[var(--amber)]", "bg-sage", "bg-[var(--orange)]"];

  return (
    <section ref={ref} className="relative overflow-hidden border-b border-qw-line bg-canvas py-24 pb-28 max-[900px]:py-16">
      <div className="qw-ghost" aria-hidden>
        {t.ghost}
      </div>
      <div className="qw-wrap relative grid grid-cols-[1fr_auto_1fr] items-center max-[900px]:grid-cols-1 max-[900px]:justify-items-center max-[900px]:gap-3.5">
        <div
          className="qw-display relative z-[1] text-end text-[clamp(64px,9vw,156px)] text-ink max-[900px]:text-center max-[900px]:text-[72px]"
          style={reduced ? undefined : { transform: `translateX(${-shift}px)` }}
        >
          {t.left}
        </div>
        <div className="relative z-[2] mx-7 max-[900px]:mx-0">
          <div className="w-[270px] bg-ink p-3">
            <div className="flex h-[520px] flex-col overflow-hidden bg-canvas text-ink">
              <div className="border-b border-qw-line bg-white px-3.5 py-3.5">
                <small className="text-[11px] text-quiet">{t.place}</small>
                <b className="block text-base">{t.menu}</b>
              </div>
              <div className="flex gap-1.5 px-3.5 py-2.5 text-xs font-semibold">
                {[t.categories.grill, t.categories.soups, t.categories.drinks, t.categories.dessert].map((name, index) => (
                  <span key={name} className={`border px-2.5 py-1.5 ${index === 0 ? "border-ink bg-ink text-canvas" : "border-qw-line bg-white"}`}>
                    {name}
                  </span>
                ))}
              </div>
              {dishes.map((dish, index) => (
                <div key={dish.name} className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5 border-b border-qw-line bg-white px-3.5 py-2.5 text-[13px]">
                  <span className={`size-[52px] ${tones[index]}`} />
                  <span>
                    <b className="block">{dish.name}</b>
                    <small className="text-quiet">{dish.detail}</small>
                    <b className="mt-1 block">
                      <span dir="ltr">{dish.price}</span>
                    </b>
                  </span>
                  <span className="grid size-[30px] place-items-center bg-sage font-bold text-white">+</span>
                </div>
              ))}
              <div className="mt-auto flex justify-between bg-ink px-3.5 py-3.5 text-sm font-bold text-canvas">
                <span>{t.cart}</span>
                <span dir="ltr">{t.total}</span>
              </div>
            </div>
          </div>
          <Bubble className="qw-float qw-bub top-[6%] -start-[230px]" color="var(--orange)" label={t.bubbles.order.label} detail={t.bubbles.order.detail} reduced={reduced} />
          <Bubble className="qw-float qw-bub top-[30%] -end-[240px] [animation-delay:-2s]" color="var(--amber)" label={t.bubbles.waiter.label} detail={t.bubbles.waiter.detail} reduced={reduced} />
          <Bubble className="qw-float qw-bub bottom-[18%] -start-[230px] [animation-delay:-4s]" color="var(--sage)" label={t.bubbles.ready.label} detail={t.bubbles.ready.detail} reduced={reduced} />
          <Bubble className="qw-float qw-bub bottom-[4%] -end-[200px] [animation-delay:-1s]" color="var(--ink)" label={t.bubbles.paid.label} detail={t.bubbles.paid.detail} reduced={reduced} />
        </div>
        <div
          className="qw-display relative z-[1] text-[clamp(64px,9vw,156px)] text-signal-new max-[900px]:text-center max-[900px]:text-[72px]"
          style={reduced ? undefined : { transform: `translateX(${shift}px)` }}
        >
          {t.right}
        </div>
      </div>
      <p className="relative z-[1] mx-auto mt-14 max-w-[620px] px-5 text-center text-lg text-quiet">{t.caption}</p>
    </section>
  );
}

function Bento({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].offer;
  const reduced = usePrefersReducedMotion();
  return (
    <section id="offer" className="bg-white">
      <div className="qw-wrap qw-sh grid grid-cols-2 items-end gap-12 py-[110px] pb-11 max-[900px]:grid-cols-1 max-[900px]:gap-4 max-[900px]:py-16 max-[900px]:pb-7">
        <Reveal reduced={reduced}>
          <span className="text-xs font-bold tracking-[0.14em] text-sage-deep uppercase">{t.eyebrow}</span>
          <h2 className="qw-display mt-3.5 text-[clamp(40px,5vw,80px)]">{t.title}</h2>
        </Reveal>
        <Reveal reduced={reduced} delay="qw-d1">
          <p className="m-0 max-w-[520px] text-lg text-quiet">{t.body}</p>
        </Reveal>
      </div>
      <div className="qw-bento">
        <Cell reduced={reduced} className="qw-s3 qw-r2 bg-[var(--orange)] text-white" tag={t.qr.tag} title={t.qr.title} body={t.qr.body} light>
          <div className="mt-auto flex items-end gap-5">
            <span className="grid size-[150px] grid-cols-5 gap-0.5 bg-white p-2.5" aria-hidden>
              {Array.from({ length: 25 }, (_, index) => (
                <i key={index} className={index % 3 === 0 ? "bg-transparent" : "bg-ink"} />
              ))}
            </span>
            <span className="qw-display text-[40px] leading-none whitespace-pre-line">{t.qr.scan}</span>
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d1" className="qw-s3 bg-[var(--amber)]" tag={t.pos.tag} title={t.pos.title} body={t.pos.body}>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="bg-ink px-2 py-1 text-[11px] font-bold text-white">{t.pos.a}</span>
            <span className="bg-ink px-2 py-1 text-[11px] font-bold text-white">{t.pos.b}</span>
            <span className="bg-signal-done px-2 py-1 text-[11px] font-bold text-white">
              <span dir="ltr">{t.pos.charge}</span>
            </span>
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d2" className="qw-s3 bg-sage-deep text-white" tag={t.kds.tag} title={t.kds.title} body={t.kds.body} light>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="bg-signal-new px-2 py-1 text-[11px] font-bold">
              <span dir="ltr">{t.kds.a}</span>
            </span>
            <span className="bg-signal-wip px-2 py-1 text-[11px] font-bold text-ink">
              <span dir="ltr">{t.kds.b}</span>
            </span>
            <span className="bg-canvas px-2 py-1 text-[11px] font-bold text-ink">
              <span dir="ltr">{t.kds.c}</span>
            </span>
          </div>
        </Cell>
        <Cell reduced={reduced} className="qw-s2 bg-canvas" tag={t.floor.tag} title={t.floor.title} body={t.floor.body}>
          <div className="mt-auto grid grid-cols-6 gap-1.5">
            {TABLES.map((tone, index) => (
              <span
                key={index}
                className={`grid h-[34px] place-items-center border text-[11px] font-bold ${tone === "o" ? "border-[var(--orange)] bg-signal-new text-white" : tone === "a" ? "border-[var(--amber)] bg-signal-wip" : tone === "s" ? "border-sage bg-signal-done text-white" : "border-qw-line bg-white"}`}
              >
                T{index + 1}
              </span>
            ))}
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d1" className="qw-s2 bg-ink text-canvas" tag={t.drive.tag} title={t.drive.title} body={t.drive.body} light>
          <div className="mt-auto flex gap-2 text-xs">
            <span className="grid flex-1 gap-0.5 border border-[#444] p-2">
              <b className="text-[var(--amber)]">{t.drive.lane1}</b>
              {t.drive.car}
            </span>
            <span className="grid flex-1 gap-0.5 border border-[#444] p-2">
              <b className="text-[var(--amber)]">{t.drive.lane2}</b>
              {t.drive.pickup}
            </span>
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d2" className="qw-s2 bg-white" tag={t.pay.tag} title={t.pay.title} body={t.pay.body}>
          <p className="qw-display mt-auto text-[34px] leading-none">
            <span dir="ltr">{t.pay.amount}</span>
          </p>
        </Cell>
        <Cell reduced={reduced} className="qw-s3 bg-white" tag={t.analytics.tag} title={t.analytics.title} body={t.analytics.body}>
          <p className="text-[11px] font-bold tracking-wide text-quiet uppercase">{t.sample}</p>
          <div className="qw-bars mt-auto flex h-[90px] items-end gap-1.5">
            {[42, 68, 50, 88, 46, 74, 60].map((height, index) => (
              <i
                key={height}
                className={`block flex-1 ${index === 5 ? "bg-[var(--orange)]" : index % 3 === 2 ? "bg-[var(--amber)]" : "bg-sage"}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d1" className="qw-s3 bg-ink text-canvas" tag={t.ask.tag} title={t.ask.title} body={t.ask.body} light>
          <div className="mt-auto grid gap-2 text-[13px]">
            <p className="justify-self-end bg-[#3a3a3a] px-2.5 py-2">{t.ask.question}</p>
            <div className="border-s-[3px] border-s-sage px-2.5 py-1">
              <p>{t.ask.lead}</p>
              <p className="qw-display text-2xl">
                <span dir="ltr">{t.ask.figure}</span>
              </p>
              <p>{t.ask.summary}</p>
              <p className="text-xs text-[#bdb5ab]">{t.ask.source}</p>
              <p className="text-[11px] font-bold tracking-wide uppercase">{t.sample}</p>
            </div>
          </div>
        </Cell>
        <Cell reduced={reduced} className="qw-s2 bg-canvas" tag={t.menu.tag} title={t.menu.title} body={t.menu.body}>
          <div className="mt-auto grid gap-1.5 text-[13px]">
            <div className="flex justify-between border border-qw-line bg-white px-2.5 py-1.5">
              <span>{t.menu.item}</span>
              <span dir="ltr">{t.menu.price}</span>
            </div>
            <div className="flex justify-between border border-qw-line bg-white px-2.5 py-1.5 text-quiet line-through">
              <span>{t.menu.soldName}</span>
              <span>{t.menu.sold}</span>
            </div>
          </div>
        </Cell>
        <Cell reduced={reduced} delay="qw-d1" className="qw-s2 bg-[var(--amber)]" tag={t.offline.tag} title={t.offline.title} body={t.offline.body}>
          <p className="mt-auto text-sm font-bold">{t.offline.status}</p>
        </Cell>
        <Cell reduced={reduced} delay="qw-d2" className="qw-s2 bg-sage-deep text-white" tag={t.lang.tag} title={t.lang.title} body={t.lang.body} light>
          <p className="qw-display mt-auto text-[84px] leading-none">{t.lang.mark}</p>
        </Cell>
      </div>
    </section>
  );
}

function Hub({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].flowHub;
  const reduced = usePrefersReducedMotion();
  return (
    <section id="flow" className="overflow-hidden border-b border-qw-line bg-white pb-[110px]">
      <div className="qw-wrap grid grid-cols-2 items-end gap-12 py-[110px] pb-11 max-[900px]:grid-cols-1 max-[900px]:gap-4 max-[900px]:py-16">
        <Reveal reduced={reduced}>
          <span className="text-xs font-bold tracking-[0.14em] text-sage-deep uppercase">{t.eyebrow}</span>
          <h2 className="qw-display mt-3.5 text-[clamp(40px,5vw,80px)]">{t.title}</h2>
        </Reveal>
        <Reveal reduced={reduced} delay="qw-d1">
          <p className="m-0 max-w-[520px] text-lg text-quiet">{t.body}</p>
        </Reveal>
      </div>
      <div className="qw-hub-stage">
        <div className="qw-hub-visual contents max-[900px]:contents">
          <svg className="absolute inset-0 h-full w-full max-[900px]:hidden" viewBox="0 0 1200 640" aria-hidden>
            {SPOKES.map((d, index) => (
              <path key={d} id={`qw-sp-${index}`} d={d} fill="none" stroke="#252525" strokeWidth="1.5" strokeDasharray="6 6" />
            ))}
            {reduced
              ? null
              : SPOKES.map((_, index) =>
                  [0, 1].map((copy) => {
                    const begin = (index * 0.33 + copy * 1.4).toFixed(2);
                    return (
                      <rect key={`${index}-${copy}`} x="-6" y="-6" width="12" height="12" fill="#F76C33">
                        <animateMotion dur="2.8s" repeatCount="indefinite" begin={`${begin}s`}>
                          <mpath href={`#qw-sp-${index}`} />
                        </animateMotion>
                        <animate attributeName="fill" values="#F76C33;#F2AC3F;#6DA290" dur="2.8s" repeatCount="indefinite" begin={`${begin}s`} />
                      </rect>
                    );
                  }),
                )}
          </svg>
        </div>
        <div className="qw-hub-center w-[220px] bg-ink px-[18px] py-[18px] text-center text-canvas shadow-[0_0_0_10px_rgb(247_108_51/0.15),0_0_0_22px_rgb(247_108_51/0.07)] max-[900px]:w-auto max-[900px]:shadow-none">
          {!reduced ? <span className={withoutMotion(reduced, "qw-pulse pointer-events-none absolute -inset-2.5 border-2 border-[var(--orange)]")} /> : null}
          <Rings />
          <b className="qw-display mt-2.5 block text-2xl">{t.order}</b>
          <small className="text-[#bdb5ab]">
            <span dir="ltr">{t.meta}</span>
          </small>
        </div>
        {FLOW_KEYS.map((key) => {
          const pos = NODE_POS[key];
          const node = t.nodes[key];
          return (
            <div
              key={key}
              className="qw-hub-node grid min-w-[170px] gap-0.5 border border-ink bg-white px-3.5 py-3 text-[13px] whitespace-nowrap shadow-[5px_5px_0_var(--c,var(--ink))] max-[900px]:w-auto max-[900px]:whitespace-normal"
              style={{ left: pos.left, top: pos.top, ["--c" as string]: pos.color }}
            >
              <b className="flex items-center gap-2 text-[15px]">
                <i aria-hidden className="inline-block size-2.5" style={{ background: pos.color }} />
                {node.label}
              </b>
              <small className="text-quiet">{node.detail}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Cell({
  reduced,
  delay,
  className,
  tag,
  title,
  body,
  light = false,
  children,
}: {
  reduced: boolean;
  delay?: string;
  className: string;
  tag: string;
  title: string;
  body: string;
  light?: boolean;
  children?: ReactNode;
}) {
  return (
    <Reveal reduced={reduced} delay={delay} className={`qw-bx relative flex flex-col gap-2 overflow-hidden p-6 ${className}`}>
      <span className={`text-[11px] font-bold tracking-[0.12em] uppercase ${light ? "opacity-70" : "text-quiet"}`}>{tag}</span>
      <h3 className="qw-display relative z-[1] text-[22px]">{title}</h3>
      <p className={`relative z-[1] m-0 max-w-[360px] text-[15px] ${light ? "text-white/80" : "text-quiet"}`}>{body}</p>
      {children}
    </Reveal>
  );
}

function Reveal({
  reduced,
  delay,
  className = "",
  children,
}: {
  reduced: boolean;
  delay?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);
  const motion = withoutMotion(reduced, shown ? "qw-in" : `qw-rv${delay ? ` ${delay}` : ""}`);
  return (
    <div ref={ref} className={`${motion} ${className}`}>
      {children}
    </div>
  );
}

function Bubble({
  className,
  color,
  label,
  detail,
  reduced,
}: {
  className: string;
  color: string;
  label: string;
  detail: string;
  reduced: boolean;
}) {
  return (
    <div
      className={`z-[3] grid min-w-[180px] gap-0.5 border border-ink bg-white px-3 py-2.5 text-[13px] shadow-[5px_5px_0_var(--c)] ${withoutMotion(reduced, className)}`}
      style={{ ["--c" as string]: color }}
    >
      <b className="flex items-center gap-2">
        <i aria-hidden className="inline-block size-2.5" style={{ background: color }} />
        {label}
      </b>
      <small className="text-quiet">{detail}</small>
    </div>
  );
}

function Rings() {
  return (
    <svg viewBox="0 0 64 32" className="mx-auto h-[26px] w-auto" aria-hidden>
      <circle cx="18" cy="16" r="11" fill="none" stroke="#6DA290" strokeWidth="5" />
      <circle cx="46" cy="16" r="11" fill="none" stroke="#6DA290" strokeWidth="5" />
    </svg>
  );
}

function useScrollProgress(reduced: boolean): { ref: RefObject<HTMLElement | null>; progress: number } {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      setProgress(Math.max(0, Math.min(1, -rect.top / Math.max(1, total))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);
  return { ref, progress };
}
