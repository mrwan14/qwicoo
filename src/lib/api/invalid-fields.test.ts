import assert from "node:assert/strict";
import { test } from "node:test";

import { invalidFields, withFields } from "./invalid-fields.ts";

test("our error shape names the field", () => {
  const body = { code: "INPUT_VALIDATION_FAILED", errors: [{ loc: ["body", "accuracy_meters"], msg: "Extra inputs are not permitted" }] };
  assert.deepEqual(invalidFields(body), ["accuracy meters"]);
});

test("FastAPI's default shape, nested and repeated fields", () => {
  const body = { detail: [{ loc: ["body", "lines", 0, "qty"] }, { loc: ["body", "lines", 1, "qty"] }, { loc: ["query", "branch_id"] }] };
  assert.deepEqual(invalidFields(body), ["qty", "branch id"]);
});

test("nothing to name", () => {
  assert.deepEqual(invalidFields({ detail: "Nope" }), []);
  assert.deepEqual(invalidFields(null), []);
  assert.equal(withFields("Check the form.", []), "Check the form.");
  assert.equal(withFields("Check the form.", ["latitude"]), "Check the form. (latitude)");
});
