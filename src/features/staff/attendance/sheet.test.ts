import assert from "node:assert/strict";
import { test } from "node:test";

import { csvCell, parseMinutes, periodRange } from "./sheet.ts";

test("periods cover whole weeks and months", () => {
  // 2026-11-11 is a Wednesday.
  assert.deepEqual(periodRange("thisWeek", "2026-11-11"), { start: "2026-11-09", end: "2026-11-15" });
  assert.deepEqual(periodRange("lastWeek", "2026-11-11"), { start: "2026-11-02", end: "2026-11-08" });
  assert.deepEqual(periodRange("thisMonth", "2026-11-11"), { start: "2026-11-01", end: "2026-11-30" });
  assert.deepEqual(periodRange("lastMonth", "2026-11-11"), { start: "2026-10-01", end: "2026-10-31" });
});

test("CSV cells are quoted and formulas are defused", () => {
  assert.equal(csvCell("Omar Said"), "Omar Said");
  assert.equal(csvCell('Said, "Omar"'), '"Said, ""Omar"""');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(-5), "-5", "numbers are left alone");
  assert.equal(csvCell("عمر"), "عمر");
});

test("rule minutes: empty is the default, junk and too large are invalid", () => {
  assert.equal(parseMinutes("", 240), null);
  assert.equal(parseMinutes(" 10 ", 240), 10);
  assert.equal(parseMinutes("0", 240), 0);
  assert.equal(parseMinutes("2.5", 240), undefined);
  assert.equal(parseMinutes("-1", 240), undefined);
  assert.equal(parseMinutes("241", 240), undefined);
});

test("till PINs and tries left after a wrong one", async () => {
  const { triesLeft, validPin } = await import("./sheet.ts");
  assert.equal(validPin("2580"), true);
  assert.equal(validPin("258"), false);
  assert.equal(validPin("2580123"), false);
  assert.equal(validPin("25a0"), false);
  assert.equal(triesLeft({ code: "ATTENDANCE_PIN_WRONG", attempts_left: 3 }), 3);
  assert.equal(triesLeft({ detail: { code: "ATTENDANCE_PIN_WRONG", attempts_left: 0 } }), 0);
  assert.equal(triesLeft({ detail: "nope" }), null);
});
