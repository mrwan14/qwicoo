import assert from "node:assert/strict";
import { test } from "node:test";

import { THEME_PRESET_IDS, buildGuestTheme, buildStaffAccent, contrast, resolveChoice } from "./theme.ts";

test("presets resolve by id and unknown input falls back to Qwicoo Citrus", () => {
  assert.equal(resolveChoice({ preset: "nile" }).brand, "#1f5f8b");
  assert.equal(resolveChoice({ preset: "nope" }).preset, "citrus");
  assert.equal(resolveChoice(null).preset, "citrus");
  assert.deepEqual(resolveChoice({ brand: "#123", background: "bad" }), { preset: "custom", brand: "#112233", background: "#f5f1ec" });
});

test("every preset keeps text, controls and button labels readable", () => {
  for (const id of THEME_PRESET_IDS) {
    const { vars } = buildGuestTheme(resolveChoice({ preset: id }));
    assert.ok(contrast(vars["--guest-ink"], vars["--guest-canvas"]) >= 10, `${id} ink`);
    assert.ok(contrast(vars["--guest-quiet"], vars["--guest-surface"]) >= 4.5, `${id} quiet`);
    assert.ok(contrast(vars["--guest-orange"], vars["--guest-surface"]) >= 3, `${id} brand`);
    assert.ok(contrast(vars["--guest-on-accent"], vars["--guest-orange"]) >= 3, `${id} on-brand`);
    assert.ok(contrast(vars["--guest-brand-text"], vars["--guest-orange-soft"]) >= 4.5, `${id} brand text`);
  }
});

test("night backgrounds switch to light text", () => {
  const theme = buildGuestTheme(resolveChoice({ preset: "night" }));
  assert.equal(theme.dark, true);
  assert.equal(theme.vars["color-scheme"], "dark");
});

test("unreadable custom colours are corrected and reported", () => {
  const pale = buildGuestTheme(resolveChoice({ brand: "#ffe8a0", background: "#ffffff" }));
  assert.equal(pale.adjusted.brand, true);
  assert.ok(contrast(pale.vars["--guest-orange"], pale.vars["--guest-surface"]) >= 3);

  const loud = buildGuestTheme(resolveChoice({ brand: "#222222", background: "#ff0000" }));
  assert.equal(loud.adjusted.background, true);
  assert.ok(contrast(loud.vars["--guest-ink"], loud.vars["--guest-canvas"]) >= 10);
});

test("the dashboard accent keeps white button text and tinted nav text readable", () => {
  assert.equal(buildStaffAccent(null), null);
  for (const id of THEME_PRESET_IDS) {
    const vars = buildStaffAccent(resolveChoice({ preset: id }));
    assert.ok(vars);
    assert.ok(contrast(vars["--brand"], "#ffffff") >= 4.5, `${id} button`);
    assert.ok(contrast(vars["--brand-ink"], vars["--brand-tint"]) >= 4.5, `${id} nav`);
    // The dashboard stays light: body text keeps full contrast on the tinted page and sidebar.
    assert.ok(contrast("#111111", vars["--page"]) >= 12, `${id} page`);
    assert.ok(contrast("#111111", vars["--side"]) >= 12, `${id} sidebar`);
  }
});

test("the dark dashboard keeps buttons, tinted nav and page text readable", () => {
  for (const id of THEME_PRESET_IDS) {
    const vars = buildStaffAccent(resolveChoice({ preset: id }), true);
    assert.ok(vars);
    assert.ok(contrast(vars["--brand"], "#ffffff") >= 4.5, `${id} button`);
    assert.ok(contrast(vars["--brand-ink"], vars["--brand-tint"]) >= 4.5, `${id} nav`);
    assert.ok(contrast("#f1f1f2", vars["--page"]) >= 12, `${id} page`);
  }
});
