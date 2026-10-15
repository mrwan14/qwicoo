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
  assert.match(guestCss, /--guest-orange:\s*#c86b3c/);
  assert.match(guestCss, /--guest-canvas:\s*#fbf6ee/);
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

test("guest layout loads Fraunces, Inter, and Cairo only", () => {
  const layout = readFileSync(new URL("../../app/(guest)/layout.tsx", import.meta.url), "utf8");
  const fonts = readFileSync(new URL("./guest-fonts.ts", import.meta.url), "utf8");
  assert.match(layout, /guestFontClassName/);
  assert.match(fonts, /Fraunces/);
  assert.match(fonts, /Inter/);
  assert.match(fonts, /Cairo/);
  assert.doesNotMatch(layout, /Nunito/);
  assert.doesNotMatch(layout, /Baloo/);
  assert.doesNotMatch(fonts, /Nunito/);
  assert.doesNotMatch(fonts, /Baloo/);
});

test("guest chrome does not repaint buttons with a restaurant accent", () => {
  const shell = readFileSync(new URL("./shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /"--guest-orange": accent/);
  assert.doesNotMatch(shell, /accentForeground/);
});

test("guest motion stays scoped under features/guest", () => {
  const motion = readFileSync(new URL("./motion.ts", import.meta.url), "utf8");
  assert.match(motion, /@gsap\/react/);
  assert.match(motion, /guestPrefersReducedMotion/);
});
