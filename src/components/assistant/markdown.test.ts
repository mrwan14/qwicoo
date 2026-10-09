import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeHtml, renderAssistantMarkdown } from "./markdown.ts";

test("markdown escapes HTML before bold, lists, and breaks", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const html = renderAssistantMarkdown("Say **hello**\n\n- one\n- two\n\nLine two");
  assert.match(html, /<strong>hello<\/strong>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<br \/>/);
  assert.doesNotMatch(html, /\*\*/);
  assert.doesNotMatch(html, /<script/);
  assert.equal(renderAssistantMarkdown("a **b** c **"), "<p>a <strong>b</strong> c </p>");
});
