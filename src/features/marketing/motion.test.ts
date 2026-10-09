import assert from "node:assert/strict";
import { test } from "node:test";

import { MOTION_CLASSES, withoutMotion } from "./motion.ts";

test("reduced motion drops animation class names", () => {
  const mixed = `hero ${MOTION_CLASSES.join(" ")} static`;
  assert.equal(withoutMotion(false, mixed), mixed);
  assert.equal(withoutMotion(true, mixed), "hero static");
  assert.equal(withoutMotion(true, "qw-drift qw-pulse"), "");
});
