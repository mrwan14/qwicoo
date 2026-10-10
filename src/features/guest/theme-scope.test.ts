import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const guestCss = readFileSync(new URL("./guest.css", import.meta.url), "utf8");
const landingCss = readFileSync(new URL("../marketing/landing.css", import.meta.url), "utf8");
const globalsCss = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("guest radius tokens live under .guest-theme only", () => {
  assert.match(guestCss, /\.guest-theme\s*\{/);
  assert.match(guestCss, /--guest-radius-pill:\s*9999px/);
  assert.match(guestCss, /--guest-radius-card:\s*16px/);
  assert.match(guestCss, /--guest-radius-sheet:\s*24px/);
  assert.doesNotMatch(guestCss, /^:root\s*\{[^}]*--guest-radius/m);
});

test("landing and globals keep square radius (no guest pill leak)", () => {
  assert.match(landingCss, /border-radius:\s*0/);
  assert.match(globalsCss, /--radius:\s*0/);
  assert.doesNotMatch(landingCss, /--guest-radius-pill/);
  assert.doesNotMatch(globalsCss, /--guest-radius-pill/);
  assert.doesNotMatch(globalsCss, /\.guest-theme/);
});
