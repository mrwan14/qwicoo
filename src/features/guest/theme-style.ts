"use client";

import { useMemo, type CSSProperties } from "react";

import type { GuestBranding } from "@/lib/guest/branding";
import { buildGuestTheme, resolveChoice, type GuestTheme } from "@/lib/guest/theme";
import { useGuest } from "@/stores/guest";

export function themeFor(branding: GuestBranding | null): GuestTheme {
  const chosen = branding?.theme;
  if (chosen) return buildGuestTheme(resolveChoice(chosen));
  // Older brands only have one accent colour: use it on the Qwicoo background.
  return buildGuestTheme(resolveChoice(branding?.accent ? { brand: branding.accent } : null));
}

/** React wants camelCase for real properties; custom properties pass through as written. */
export function themeStyle(theme: GuestTheme): CSSProperties {
  const { "color-scheme": colorScheme, ...custom } = theme.vars;
  return { ...custom, colorScheme } as CSSProperties;
}

/**
 * The restaurant's theme for a portaled surface (sheet, drawer, dialog, menu). `.guest-theme` re-declares
 * Qwicoo's default colours on the element itself, so anything rendered outside the shell must carry the
 * restaurant's variables inline or it falls back to orange.
 */
export function useGuestThemeProps(): { style: CSSProperties; "data-dark": "true" | "false" } {
  const branding = useGuest((state) => state.branding);
  return useMemo(() => {
    const theme = themeFor(branding);
    return { style: themeStyle(theme), "data-dark": theme.dark ? "true" : "false" };
  }, [branding]);
}
