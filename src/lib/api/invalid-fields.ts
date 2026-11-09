/**
 * Which fields a 422 complained about, so "Some details are missing or invalid" can say which ones.
 * Reads FastAPI's `detail: [{loc, msg}]` and our `{code, errors: [{loc, msg}]}` shapes.
 */
export function invalidFields(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];
  const list =
    ("errors" in error && Array.isArray(error.errors) && error.errors) ||
    ("detail" in error && Array.isArray(error.detail) && error.detail) ||
    [];
  const names: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || !("loc" in item) || !Array.isArray(item.loc)) continue;
    const field = [...item.loc].reverse().find((part) => typeof part === "string" && part !== "body" && part !== "query");
    if (typeof field !== "string") continue;
    const label = field.replace(/_/g, " ").trim();
    if (label && !names.includes(label)) names.push(label);
  }
  return names.slice(0, 3);
}

/** The message with the failing fields after it, e.g. "… (latitude, accuracy meters)". */
export function withFields(message: string, fields: readonly string[]): string {
  return fields.length ? `${message} (${fields.join(", ")})` : message;
}
