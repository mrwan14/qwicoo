import assert from "node:assert/strict";
import { test } from "node:test";

import type { AssistantChatResponse } from "./model.ts";
import { answerBlockClass, chartRows, classifyAssistantError, presentAnswer } from "./model.ts";

const copy = {
  disabled: "Not available yet",
  limit: "You've reached this month's question limit.",
  network: "The connection dropped. Try again.",
};

const rich: AssistantChatResponse = {
  answer: "Lunch was the busy period.",
  refused: false,
  sources: ["Sales", "  "],
  tables: [{ columns: ["Hour", "Orders"], rows: [["13", "40"], ["14", "22"]] }],
  chart: {
    type: "bar",
    series: [{ name: "Orders", points: [{ x: "13", y: "40" }, { x: "14", y: "nope" }, { x: "15", y: "12" }] }],
  },
};

test("an answer keeps its table, chart points, and sources", () => {
  const view = presentAnswer(rich);
  assert.equal(view.tone, "answer");
  assert.equal(view.text, "Lunch was the busy period.");
  assert.deepEqual(view.tables, [{ columns: ["Hour", "Orders"], rows: [["13", "40"], ["14", "22"]] }]);
  assert.deepEqual(view.sources, ["Sales"]);
  assert.equal(view.chart?.type, "bar");
  assert.deepEqual(view.chart?.series[0].points, [
    { x: "13", y: 40 },
    { x: "15", y: 12 },
  ]);
  assert.deepEqual(chartRows(view.chart!), {
    keys: ["Orders"],
    rows: [
      { x: "13", values: { Orders: 40 } },
      { x: "15", values: { Orders: 12 } },
    ],
  });
  assert.match(answerBlockClass(view.tone), /bg-card/);
});

test("a refusal is quiet and drops tables, charts, and sources", () => {
  const view = presentAnswer({ ...rich, refused: true, answer: "I can only answer about this restaurant." });
  assert.equal(view.tone, "refusal");
  assert.equal(view.text, "I can only answer about this restaurant.");
  assert.deepEqual(view.tables, []);
  assert.equal(view.chart, null);
  assert.deepEqual(view.sources, []);
  assert.match(answerBlockClass(view.tone), /bg-muted/);
  assert.doesNotMatch(answerBlockClass(view.tone), /bg-card/);
});

test("disabled, limit, and network states never show the raw code", () => {
  assert.deepEqual(classifyAssistantError({ status: 503, code: "ASSISTANT_DISABLED", detail: "ASSISTANT_DISABLED" }, "en", copy), {
    kind: "disabled",
    message: copy.disabled,
  });
  assert.deepEqual(
    classifyAssistantError({ status: 429, code: "ASSISTANT_LIMIT_REACHED", detail: "80 of 80 questions used this month." }, "en", copy),
    { kind: "limit", message: "80 of 80 questions used this month." },
  );
  assert.deepEqual(classifyAssistantError({ status: 429, code: "ASSISTANT_LIMIT_REACHED", detail: "ASSISTANT_LIMIT_REACHED" }, "en", copy), {
    kind: "limit",
    message: copy.limit,
  });
  assert.deepEqual(
    classifyAssistantError({ status: 429, code: "ASSISTANT_LIMIT_REACHED", detail: "تم بلوغ الحد" }, "en", copy),
    { kind: "limit", message: copy.limit },
  );
  const dropped = classifyAssistantError(new TypeError("Failed to fetch"), "ar", copy);
  assert.equal(dropped.kind, "network");
  assert.equal(dropped.message, copy.network);
  assert.equal(dropped.message.includes("ASSISTANT"), false);
});
