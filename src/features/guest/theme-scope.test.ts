import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const guestCss = readFileSync(new URL("./guest.css", import.meta.url), "utf8");
const landingCss = readFileSync(new URL("../marketing/landing.css", import.meta.url), "utf8");
const globalsCss = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("guest radius tokens live under .guest-theme only", () => {
  assert.match(guestCss, /\.guest-theme\s*\{/);
  assert.match(guestCss, /--guest-radius-pill:\s*9999px/);
  assert.match(guestCss, /--guest-radius-card:\s*24px/);
  assert.match(guestCss, /--guest-radius-sheet:\s*32px/);
  assert.match(guestCss, /--guest-btn-h:\s*56px/);
  assert.match(guestCss, /--guest-orange:\s*#f96d34/);
  assert.match(guestCss, /--guest-canvas:\s*#f5f1ec/);
  assert.match(guestCss, /--guest-highlight:\s*#f4ad40/);
  assert.match(guestCss, /--guest-sage:\s*#6ea292/);
  assert.match(guestCss, /font-family:\s*var\(--font-guest-arabic\)/);
  assert.match(guestCss, /\.guest-btn-primary/);
  assert.match(guestCss, /\.guest-sheet-footer/);
  assert.match(guestCss, /\.guest-menu-row/);
  assert.doesNotMatch(guestCss, /^:root\s*\{[^}]*--guest-radius/m);
});

test("landing and globals keep square radius (no guest pill leak)", () => {
  assert.match(landingCss, /border-radius:\s*0/);
  assert.match(globalsCss, /--radius:\s*0/);
  assert.doesNotMatch(landingCss, /--guest-radius-pill/);
  assert.doesNotMatch(globalsCss, /--guest-radius-pill/);
  assert.doesNotMatch(globalsCss, /\.guest-theme/);
});

test("guest layout loads the Qwicoo IBM Plex family only", () => {
  const layout = readFileSync(new URL("../../app/(guest)/layout.tsx", import.meta.url), "utf8");
  const fonts = readFileSync(new URL("./guest-fonts.ts", import.meta.url), "utf8");
  assert.match(layout, /guestFontClassName/);
  // Self-hosted files (builds no longer fetch Google Fonts).
  assert.match(fonts, /plex-sans\.woff2/);
  assert.match(fonts, /plex-sans-arabic-regular\.woff2/);
  assert.doesNotMatch(fonts, /fraunces|cairo|inter\.woff2/i);
  assert.doesNotMatch(layout, /Nunito/);
  assert.doesNotMatch(layout, /Baloo/);
  assert.doesNotMatch(fonts, /Nunito/);
  assert.doesNotMatch(fonts, /Baloo/);
});

test("restaurant themes repaint the guest chrome only through the theme engine", () => {
  const shell = readFileSync(new URL("./shell.tsx", import.meta.url), "utf8");
  const themeStyle = readFileSync(new URL("./theme-style.ts", import.meta.url), "utf8");
  assert.match(themeStyle, /buildGuestTheme/);
  assert.doesNotMatch(shell, /"--guest-orange": accent/);
  // Portaled sheets carry the restaurant's variables, or `.guest-theme` resets them to Qwicoo orange.
  const sheet = readFileSync(new URL("./bottom-sheet.tsx", import.meta.url), "utf8");
  assert.match(sheet, /useGuestThemeProps/);
  // Order-status colours stay Qwicoo's: the engine never sets them.
  const theme = readFileSync(new URL("../../lib/guest/theme.ts", import.meta.url), "utf8");
  assert.doesNotMatch(theme, /"--guest-sage"|"--guest-amber"|"--guest-error":/);
});

test("guest motion stays scoped under features/guest", () => {
  const motion = readFileSync(new URL("./motion.ts", import.meta.url), "utf8");
  assert.match(motion, /@gsap\/react/);
  assert.match(motion, /guestPrefersReducedMotion/);
});
