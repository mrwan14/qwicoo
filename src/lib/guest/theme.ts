/**
 * Restaurant themes for the guest pages.
 *
 * A restaurant picks a preset or two custom colours (brand and background). Everything
 * else (surfaces, text, lines, soft tints, the colour on buttons) is derived here so any
 * pair stays readable. Order-status colours, error red, type, radius and spacing are
 * Qwicoo's and never change.
 */

export const THEME_PRESETS = {
  citrus: { brand: "#f96d34", background: "#f5f1ec" },
  sage: { brand: "#3f6657", background: "#eef2ee" },
  espresso: { brand: "#6b4226", background: "#f6efe7" },
  nile: { brand: "#1f5f8b", background: "#eef3f7" },
  rose: { brand: "#b83b62", background: "#fbf1f2" },
  night: { brand: "#f4ad40", background: "#1b1a18" },
} as const;

export type ThemePresetId = keyof typeof THEME_PRESETS;
export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePresetId[];
export const DEFAULT_PRESET: ThemePresetId = "citrus";

export type GuestThemeChoice = { preset: ThemePresetId | "custom"; brand: string; background: string };

export type GuestTheme = {
  dark: boolean;
  /** CSS custom properties to set on the guest root and on body (for portaled sheets). */
  vars: Record<string, string>;
  /** Plain-language problems the dashboard preview shows; the guest pages already fixed them. */
  adjusted: { brand: boolean; background: boolean };
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!HEX.test(raw)) return null;
  if (raw.length === 4) return `#${raw.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  return raw.toLowerCase();
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** a → b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (hi === lo ? lo + 0.05 : lo + 0.05);
}

const INK = "#252525";
const PAPER = "#ffffff";
const NIGHT_INK = "#f4efe8";

/** Walk `color` toward `toward` until it reaches `ratio` against `against`. */
function reach(color: string, against: string, ratio: number, toward: string): string {
  let out = color;
  for (let step = 1; step <= 20 && contrast(out, against) < ratio; step += 1) out = mix(color, toward, step / 20);
  return out;
}

export function resolveChoice(input: { preset?: unknown; brand?: unknown; background?: unknown } | null | undefined): GuestThemeChoice {
  const preset = typeof input?.preset === "string" ? input.preset : null;
  if (preset && preset in THEME_PRESETS) {
    const p = THEME_PRESETS[preset as ThemePresetId];
    return { preset: preset as ThemePresetId, brand: p.brand, background: p.background };
  }
  const brand = normalizeHex(input?.brand);
  const background = normalizeHex(input?.background);
  if (brand || background) {
    const base = THEME_PRESETS[DEFAULT_PRESET];
    return { preset: "custom", brand: brand ?? base.brand, background: background ?? base.background };
  }
  const base = THEME_PRESETS[DEFAULT_PRESET];
  return { preset: DEFAULT_PRESET, brand: base.brand, background: base.background };
}

export function buildGuestTheme(choice: GuestThemeChoice): GuestTheme {
  const background = choice.background;
  const dark = luminance(background) < 0.18;
  const ink = dark ? NIGHT_INK : INK;

  // Very saturated or mid-grey backgrounds make body text struggle: pull them toward paper or night.
  let canvas = background;
  if (contrast(ink, canvas) < 10) canvas = reach(background, ink, 10, dark ? "#000000" : PAPER);

  const surface = dark ? mix(canvas, "#ffffff", 0.07) : mix(canvas, PAPER, 0.75);
  const sunken = dark ? mix(canvas, "#ffffff", 0.12) : mix(canvas, INK, 0.05);
  const line = dark ? mix(canvas, "#ffffff", 0.16) : mix(canvas, INK, 0.1);
  const lineStrong = dark ? mix(canvas, "#ffffff", 0.24) : mix(canvas, INK, 0.16);
  const quiet = reach(mix(ink, canvas, 0.38), surface, 4.6, ink);
  const faint = reach(mix(ink, canvas, 0.55), surface, 3, ink);

  // The brand colour has to read as a control on the page and on cards (3:1, WCAG non-text).
  const brand = reach(choice.brand, surface, 3, dark ? "#ffffff" : INK);
  const brandDeep = dark ? mix(brand, "#ffffff", 0.25) : mix(brand, INK, 0.22);
  // Button labels are large and bold, so white only needs 3:1 (WCAG large text). Qwicoo prefers white.
  const onBrand = contrast(brand, PAPER) >= 3 ? PAPER : INK;
  const brandSoft = mix(brand, surface, dark ? 0.78 : 0.84);
  const brandText = reach(brand, brandSoft, 4.5, dark ? "#ffffff" : INK);

  return {
    dark,
    adjusted: { brand: brand !== choice.brand, background: canvas !== background },
    vars: {
      "--guest-canvas": canvas,
      "--guest-surface": surface,
      "--guest-sunken": sunken,
      "--guest-tint": sunken,
      "--guest-muted": sunken,
      "--guest-line": line,
      "--guest-line-strong": lineStrong,
      "--guest-skeleton": line,
      "--guest-ink": ink,
      "--guest-quiet": quiet,
      "--guest-faint": faint,
      "--guest-orange": brand,
      "--guest-orange-deep": brandDeep,
      "--guest-orange-soft": brandSoft,
      "--guest-brand-text": brandText,
      "--guest-on-accent": onBrand,
      "--guest-overlay": dark ? "#000000a6" : "#25252580",
      "--guest-success-soft": dark ? mix(canvas, "#6ea292", 0.3) : "#d4e5dd",
      "--guest-error-soft": dark ? mix(canvas, "#d0614f", 0.3) : "#f4d9d4",
      "--guest-highlight-soft": dark ? mix(canvas, "#f4ad40", 0.3) : "#fbe7b8",
      "--guest-highlight-ink": dark ? "#f6d38f" : "#8a6a1c",
      "color-scheme": dark ? "dark" : "light",
    },
  };
}

/**
 * The staff dashboard's accent from the brand colour. Only the accent changes (primary buttons,
 * selected navigation, focus); backgrounds, greys and status colours stay neutral.
 */
export function buildStaffAccent(choice: GuestThemeChoice | null, darkMode = false): Record<string, string> | null {
  if (!choice) return null;
  if (darkMode) return buildStaffAccentDark(choice);
  // Button labels on the dashboard are 13-14px, so white needs the full 4.5:1.
  const brand = reach(choice.brand, PAPER, 4.5, INK);
  const tint = mix(brand, PAPER, 0.9);
  // The dashboard stays light (dark mode is a personal setting): a dark guest background
  // becomes a soft tint of the brand colour instead.
  const dark = luminance(choice.background) < 0.18;
  const page = dark ? mix(brand, PAPER, 0.95) : mix(choice.background, PAPER, 0.35);
  const side = dark ? mix(brand, PAPER, 0.9) : mix(page, INK, 0.035);
  return {
    "--brand": brand,
    "--on-brand": PAPER,
    "--brand-tint": tint,
    "--brand-ink": reach(brand, tint, 4.5, INK),
    "--page": page,
    "--side": side,
  };
}

const NIGHT_PAGE = "#111113";
const NIGHT_SIDE = "#161618";
const NIGHT_CARD = "#1b1b1e";

/** Dark dashboard: the page and sidebar carry a faint brand tint, buttons keep white labels. */
function buildStaffAccentDark(choice: GuestThemeChoice): Record<string, string> {
  // Buttons need white text at 4.5:1 and still need to stand out from the near-black page.
  let brand = reach(choice.brand, PAPER, 4.5, INK);
  if (contrast(brand, NIGHT_PAGE) < 2) brand = mix(brand, PAPER, 0.12);
  const page = mix(NIGHT_PAGE, brand, 0.05);
  const side = mix(NIGHT_SIDE, brand, 0.08);
  const tint = mix(NIGHT_CARD, brand, 0.28);
  return {
    "--brand": brand,
    "--on-brand": PAPER,
    "--brand-tint": tint,
    "--brand-ink": reach(mix(brand, PAPER, 0.35), tint, 4.5, PAPER),
    "--page": page,
    "--side": side,
  };
}
