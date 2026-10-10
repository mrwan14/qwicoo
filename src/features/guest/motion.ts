"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };

/** Guest-only motion — skip heavy timelines when the diner prefers less motion. */
export function guestPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const guestEase = "power3.out";
export const guestEaseSoft = "power2.inOut";
