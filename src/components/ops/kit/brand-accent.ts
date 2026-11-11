"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { browserApi } from "@/lib/api/browser";
import { buildStaffAccent, resolveChoice } from "@/lib/guest/theme";
import { useScope } from "@/stores/scope";

type ThemeFields = { preset?: unknown; brand_color?: unknown; background_color?: unknown; primary_color?: unknown };

function choiceFrom(theme: ThemeFields | null | undefined) {
  if (!theme || (!theme.preset && !theme.brand_color && !theme.primary_color)) return null;
  return resolveChoice({ preset: theme.preset, brand: theme.brand_color ?? theme.primary_color, background: theme.background_color });
}

/**
 * The dashboard accent for the brand in view. Brand and branch staff get their brand's colour;
 * on the platform scope Qwicoo's own look stays, until an App Admin opens one brand.
 */
export function useStaffBrandAccent(dark = false): Record<string, string> | null {
  const homeScope = useScope((state) => state.homeScope);
  const ownTheme = useScope((state) => state.brandTheme);
  const focusedBrandId = useScope((state) => (state.homeScope === "platform" ? state.brandId : null));
  const previewTheme = useScope((state) => state.previewTheme);

  const focused = useQuery({
    queryKey: ["brand", focusedBrandId],
    enabled: Boolean(focusedBrandId),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: focusedBrandId ?? "" } } });
      return result.response.ok ? (result.data ?? null) : null;
    },
  });

  const accent = useMemo(() => {
    // Brand look is open with unsaved colours: show them everywhere while the admin decides.
    if (previewTheme) return buildStaffAccent(choiceFrom(previewTheme), dark);
    if (homeScope === "platform") {
      if (!focusedBrandId) return null;
      return buildStaffAccent(choiceFrom(focused.data?.theme_config as ThemeFields | undefined), dark);
    }
    return buildStaffAccent(choiceFrom(ownTheme), dark);
  }, [dark, focused.data, focusedBrandId, homeScope, ownTheme, previewTheme]);

  // Dialogs, menus and toasts are portaled to body, so the accent lives there too.
  useEffect(() => {
    if (!accent) return;
    const body = document.body;
    for (const [name, value] of Object.entries(accent)) body.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(accent)) body.style.removeProperty(name);
    };
  }, [accent]);

  return accent;
}
