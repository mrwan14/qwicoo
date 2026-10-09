import assert from "node:assert/strict";
import { test } from "node:test";

import { guestCopy, guestServiceStatus, guestServiceType, guestStatus } from "../../features/guest/copy.ts";
import { landingCopy } from "../../features/marketing/copy.ts";
import { staffCopy } from "./staff/index.ts";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
    return [prefix];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.keys(value).flatMap((key) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return leafPaths((value as Record<string, unknown>)[key], next);
    });
  }
  return [prefix];
}

function assertSameKeys(name: string, en: unknown, ar: unknown) {
  const enPaths = leafPaths(en);
  const arPaths = leafPaths(ar);
  const enSet = new Set(enPaths);
  const arSet = new Set(arPaths);
  const missing = enPaths.filter((path) => !arSet.has(path));
  const extra = arPaths.filter((path) => !enSet.has(path));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${name} en/ar keys differ`);
}

test("english and arabic dictionaries have the same keys", () => {
  assertSameKeys("staff", staffCopy.en, staffCopy.ar);
  assertSameKeys("guest", guestCopy.en, guestCopy.ar);
  assertSameKeys("guestStatus", guestStatus.en, guestStatus.ar);
  assertSameKeys("guestServiceType", guestServiceType.en, guestServiceType.ar);
  assertSameKeys("guestServiceStatus", guestServiceStatus.en, guestServiceStatus.ar);
  assertSameKeys("marketing", landingCopy.en, landingCopy.ar);
});
