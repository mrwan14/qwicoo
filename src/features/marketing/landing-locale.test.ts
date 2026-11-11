import assert from "node:assert/strict";
import { test } from "node:test";

import { pickLandingLocale } from "./landing-locale.ts";

test("?lang= wins over the browser language", () => {
  assert.equal(pickLandingLocale("en", "ar-EG"), "en");
  assert.equal(pickLandingLocale(["ar"], "en-US"), "ar");
});

test("the page opens in Arabic unless the browser prefers English", () => {
  assert.equal(pickLandingLocale(undefined, null), "ar");
  assert.equal(pickLandingLocale(undefined, "ar-EG,ar;q=0.9,en;q=0.8"), "ar");
  assert.equal(pickLandingLocale(undefined, "fr-FR,en;q=0.5"), "ar");
  assert.equal(pickLandingLocale(undefined, "en-GB,en;q=0.9"), "en");
  assert.equal(pickLandingLocale("de", "en-US"), "en");
});
