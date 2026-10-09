import assert from "node:assert/strict";
import { test } from "node:test";

import { staffAuthorization } from "@/lib/api/public-proxy.ts";

import {
  launcherReducer,
  leadFormPhase,
  placeLauncher,
  publicAssistantInit,
  publicChatUrl,
  publicRequestHasNoAuth,
  validateLead,
} from "./public-assistant.ts";

const draft = {
  name: "Mona Adel",
  restaurant: "Mousa Cafe",
  contact: "mona@example.com",
  city: "Cairo",
  branches: "3",
  message: "We have three branches.",
};

test("the launcher opens and keeps the chat mounted", () => {
  const opened = launcherReducer({ open: false, mounted: false }, "open");
  assert.deepEqual(opened, { open: true, mounted: true });
  assert.deepEqual(launcherReducer(opened, "close"), { open: false, mounted: true });
});

test("public assistant requests never send auth or scope headers", () => {
  const init = publicAssistantInit("ar", { locale: "ar", messages: [{ role: "user", content: "Hello" }] });
  assert.equal(publicChatUrl(), "/api/v1/assistant/public/chat");
  assert.equal(publicRequestHasNoAuth(init), true);
  assert.equal(new Headers(init.headers).get("accept-language"), "ar");
  assert.equal(staffAuthorization(["assistant", "public", "chat"], "staff-token"), null);
  assert.equal(staffAuthorization(["assistant", "chat"], "staff-token"), "Bearer staff-token");
});

test("the partner form validates and then shows thanks", () => {
  const invalid = validateLead({ ...draft, name: "A", contact: "hello", branches: "0" }, "en");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.deepEqual(invalid.errors, ["name", "contact", "branches"]);

  const valid = validateLead(draft, "ar");
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.body.restaurant_name, "Mousa Cafe");
    assert.equal(valid.body.branches_count, 3);
    assert.equal(valid.body.locale, "ar");
    assert.equal("authorization" in valid.body, false);
  }
  assert.equal(leadFormPhase(false), "form");
  assert.equal(leadFormPhase(true), "thanks");
});

test("launcher geometry does not overlap the hero or the form at 390px", () => {
  const viewport = { width: 390, height: 844 };
  const hero = { top: -600, left: 0, right: 390, bottom: 80 };
  const form = { top: 400, left: 16, right: 374, bottom: 900 };
  const placed = placeLauncher(viewport, [hero, form]);
  assert.equal(placed.hidden, false);
  if (placed.hidden) return;
  const tab = {
    top: placed.top,
    left: viewport.width - placed.inset - 56,
    right: viewport.width - placed.inset,
    bottom: placed.top + 56,
  };
  assert.equal(tab.bottom <= form.top && tab.top >= hero.bottom, true);
});
