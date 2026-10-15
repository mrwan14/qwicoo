"use client";

import { useRef, type ReactNode, type RefObject } from "react";

import { guestEase, guestEaseSoft, guestPrefersReducedMotion, gsap, useGSAP } from "@/features/guest/motion";

/** Stagger-fade children into view — used across menu, presence, track. */
export function GuestReveal({
  children,
  className,
  stagger = 0.07,
  y = 18,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const nodes = root.current?.querySelectorAll<HTMLElement>("[data-guest-reveal]");
      if (!nodes?.length) return;
      if (guestPrefersReducedMotion()) {
        gsap.set(nodes, { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }
      gsap.fromTo(
        nodes,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.5, stagger, ease: guestEase, clearProps: "transform" },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

/** Soft pulse bars while guest data loads. */
export function GuestMotionSkeleton({ label }: { label?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (guestPrefersReducedMotion()) return;
      gsap.to(".guest-skel-bar", {
        opacity: 0.45,
        duration: 0.7,
        stagger: { each: 0.12, yoyo: true, repeat: -1 },
        ease: guestEaseSoft,
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} role="status" className="grid gap-3" aria-live="polite">
      <div className="guest-skel-bar h-8 w-36" />
      <div className="guest-skel-bar h-24 w-full" />
      <div className="guest-skel-bar h-14 w-full" />
      <div className="guest-skel-bar h-14 w-3/4" />
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

type WaitingMode = "sent" | "preparing" | "ready";

/**
 * GSAP waiting / success scene for post-order moments.
 * Rings + orb inspired by polished product waits (see gsap.com motion craft).
 */
export function OrderWaitingScene({
  mode,
  title,
  body,
  children,
}: {
  mode: WaitingMode;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const accent =
    mode === "ready" ? "var(--guest-sage)" : mode === "sent" ? "var(--guest-sage)" : "var(--guest-orange)";

  useGSAP(
    () => {
      const reduced = guestPrefersReducedMotion();
      gsap.set([".guest-wait-ring", ".guest-wait-orb", ".guest-wait-copy", ".guest-wait-actions"], {
        opacity: 1,
      });

      if (reduced) {
        gsap.set(".guest-wait-ring", { scale: 1, opacity: 0.35 });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: guestEase } });
      intro
        .from(".guest-wait-orb", { scale: 0.6, opacity: 0, duration: 0.55 })
        .from(".guest-wait-mark", { scale: 0.4, opacity: 0, duration: 0.4 }, "-=0.25")
        .from(".guest-wait-copy > *", { y: 14, opacity: 0, stagger: 0.08, duration: 0.45 }, "-=0.2")
        .from(".guest-wait-actions", { y: 12, opacity: 0, duration: 0.4 }, "-=0.15");

      if (mode === "preparing" || mode === "sent") {
        gsap.to(".guest-wait-ring", {
          scale: 1.55,
          opacity: 0,
          duration: 1.8,
          stagger: { each: 0.45, repeat: -1 },
          ease: "power1.out",
          transformOrigin: "50% 50%",
        });
        gsap.to(".guest-wait-orb", {
          scale: 1.04,
          duration: 1.1,
          yoyo: true,
          repeat: -1,
          ease: guestEaseSoft,
        });
        if (mode === "preparing") {
          gsap.to(".guest-wait-spin", {
            rotation: 360,
            duration: 1.2,
            repeat: -1,
            ease: "none",
          });
          gsap.to(".guest-wait-dot", {
            y: -8,
            duration: 0.55,
            stagger: { each: 0.12, yoyo: true, repeat: -1 },
            ease: guestEaseSoft,
          });
        }
      } else {
        gsap.fromTo(
          ".guest-wait-burst",
          { scale: 0.4, opacity: 0.55 },
          { scale: 1.8, opacity: 0, duration: 0.9, ease: "power2.out" },
        );
      }
    },
    { scope: root, dependencies: [mode] },
  );

  return (
    <div ref={root} className="grid gap-6 py-6 text-center">
      <div className="relative mx-auto grid size-36 place-items-center" aria-hidden>
        <span
          className="guest-wait-burst pointer-events-none absolute inset-0 rounded-full"
          style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)` }}
        />
        <span
          className="guest-wait-ring absolute inset-0 rounded-full border-2"
          style={{ borderColor: accent, opacity: 0.55 }}
        />
        <span
          className="guest-wait-ring absolute inset-2 rounded-full border-2"
          style={{ borderColor: accent, opacity: 0.4 }}
        />
        <span
          className="guest-wait-ring absolute inset-4 rounded-full border-2"
          style={{ borderColor: accent, opacity: 0.25 }}
        />
        <span
          className="guest-wait-orb relative grid size-20 place-items-center rounded-full text-white shadow-[var(--guest-shadow-btn)]"
          style={{ background: accent }}
        >
          <span className="guest-wait-mark grid place-items-center">
            {mode === "preparing" ? (
              <svg className="guest-wait-spin size-9" viewBox="0 0 36 36" fill="none" aria-hidden>
                <circle cx="18" cy="18" r="14" stroke="rgb(255 255 255 / 0.28)" strokeWidth="3" />
                <path
                  d="M18 4a14 14 0 0 1 14 14"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <span className="guest-display text-3xl leading-none">✓</span>
            )}
          </span>
        </span>
        {mode === "preparing" ? (
          <span className="absolute -bottom-1 flex gap-1.5">
            <span className="guest-wait-dot size-1.5 rounded-full bg-[var(--guest-orange)]" />
            <span className="guest-wait-dot size-1.5 rounded-full bg-[var(--guest-orange)]" />
            <span className="guest-wait-dot size-1.5 rounded-full bg-[var(--guest-orange)]" />
          </span>
        ) : null}
      </div>

      <div className="guest-wait-copy grid gap-2 px-2">
        <h1 className="guest-display guest-display-lg text-[var(--guest-ink)]">{title}</h1>
        {body ? <p className="guest-body mx-auto max-w-[18rem]">{body}</p> : null}
      </div>

      {children ? <div className="guest-wait-actions grid gap-2">{children}</div> : null}
    </div>
  );
}

/** Animate kitchen step list when status advances. */
export function GuestTrackSteps({
  steps,
  current,
  labelFor,
  toneFor,
}: {
  steps: readonly string[];
  current: number;
  labelFor: (step: string) => string;
  toneFor: (step: string) => string;
}) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      if (guestPrefersReducedMotion()) return;
      const active = root.current?.querySelector("[data-active='true']");
      if (!active) return;
      gsap.fromTo(
        active,
        { scale: 0.98, boxShadow: "0 0 0 0 transparent" },
        {
          scale: 1,
          boxShadow: "0 0 0 4px color-mix(in srgb, var(--guest-orange) 18%, transparent)",
          duration: 0.45,
          ease: guestEase,
        },
      );
    },
    { scope: root, dependencies: [current] },
  );

  return (
    <ol ref={root} className="grid gap-2">
      {steps.map((step, index) => {
        const reached = index <= current;
        const active = index === current;
        const tone = toneFor(step);
        return (
          <li
            key={step}
            data-active={active ? "true" : "false"}
            className="flex items-center gap-3 rounded-[var(--guest-radius-card)] border border-[var(--guest-line)] bg-white px-3 py-3"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: reached ? tone : "var(--guest-line-strong)" }}
            >
              {index + 1}
            </span>
            <span className={reached ? "font-semibold text-[var(--guest-ink)]" : "text-[var(--guest-quiet)]"}>
              {labelFor(step)}
            </span>
            {active ? (
              <span className="ms-auto size-2 animate-pulse rounded-full" style={{ background: tone }} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Subtle press scale for primary guest CTAs when tapped (optional wrapper). */
export function useGuestPress(ref: RefObject<HTMLElement | null>) {
  useGSAP(() => {
    const el = ref.current;
    if (!el || guestPrefersReducedMotion()) return;
    const down = () => gsap.to(el, { scale: 0.97, duration: 0.12, ease: "power2.out" });
    const up = () => gsap.to(el, { scale: 1, duration: 0.22, ease: guestEase });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerleave", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [ref]);
}
