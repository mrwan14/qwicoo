/**
 * Brand look for guest pages. The guest API does not publish branding yet, so
 * this reads whichever of these fields a response carries and ignores the rest:
 * `brand_name`, `brand_logo_url` / `logo_url`, `accent_color` /
 * `brand_accent_color`, `theme_config.primary_color` / `theme_config.accent_color`,
 * or the same inside a nested `brand` object.
 */
export type GuestBranding = {
  name: string | null;
  logoUrl: string | null;
  accent: string | null;
};

/** Warm page background (`--background`). Brand accents must hold 3:1 against it. */
const PAGE_BACKGROUND = "#f7f4ef";
const LIGHT_TEXT = "#fff8f3";
const DARK_TEXT = "#1c1612";
const MIN_CONTRAST = 3;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeHex(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !HEX.test(raw)) return null;
  if (raw.length === 4) return `#${raw.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  return raw.toLowerCase();
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The brand color if it reads on the warm background, otherwise null (use Qwicoo primary). */
export function usableAccent(value: unknown): string | null {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return contrastRatio(hex, PAGE_BACKGROUND) >= MIN_CONTRAST ? hex : null;
}

export function accentForeground(accent: string): string {
  return contrastRatio(accent, LIGHT_TEXT) >= contrastRatio(accent, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

function fromOne(payload: unknown): Partial<GuestBranding> {
  const root = record(payload);
  if (!root) return {};
  const brand = record(root.brand);
  const theme = record(root.theme_config) ?? record(brand?.theme_config);
  return {
    name: text(root.brand_name) ?? text(brand?.name) ?? undefined,
    logoUrl: text(root.brand_logo_url) ?? text(brand?.logo_url) ?? text(root.logo_url) ?? undefined,
    accent:
      usableAccent(root.accent_color) ??
      usableAccent(root.brand_accent_color) ??
      usableAccent(theme?.primary_color) ??
      usableAccent(theme?.accent_color) ??
      undefined,
  };
}

/** Later payloads fill gaps left by earlier ones; they never erase a known value. */
export function mergeGuestBranding(current: GuestBranding | null, ...payloads: unknown[]): GuestBranding {
  const next: GuestBranding = { name: null, logoUrl: null, accent: null, ...current };
  for (const payload of payloads) {
    const found = fromOne(payload);
    next.name ??= found.name ?? null;
    next.logoUrl ??= found.logoUrl ?? null;
    next.accent ??= found.accent ?? null;
  }
  return next;
}

export function sameBranding(a: GuestBranding | null, b: GuestBranding | null): boolean {
  return a?.name === b?.name && a?.logoUrl === b?.logoUrl && a?.accent === b?.accent;
}
