import assert from "node:assert/strict";
import { test } from "node:test";

import { guestCopy } from "./copy.ts";

test("arabic guest copy mirrors English keys for RTL parity", () => {
  const en = Object.keys(guestCopy.en).sort();
  const ar = Object.keys(guestCopy.ar).sort();
  assert.deepEqual(ar, en);
});

test("table and guest fallback placeholders stay in both locales", () => {
  assert.match(guestCopy.en.tableLabel, /\{n\}/);
  assert.match(guestCopy.ar.tableLabel, /\{n\}/);
  assert.match(guestCopy.en.guestFallback, /\{n\}/);
  assert.match(guestCopy.ar.guestFallback, /\{n\}/);
  assert.match(guestCopy.en.someoneAdded, /\{name\}/);
  assert.match(guestCopy.ar.someoneAdded, /\{name\}/);
});

test("dir helper for guest locale is rtl only for Arabic", () => {
  function dir(locale: "en" | "ar") {
    return locale === "ar" ? "rtl" : "ltr";
  }
  assert.equal(dir("en"), "ltr");
  assert.equal(dir("ar"), "rtl");
});
