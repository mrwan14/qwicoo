/** API origin without a path. Callers append `/api/v1` themselves. */
export function getApiOrigin(): string {
  const raw =
    process.env.API_BASE_URL ??
    process.env.API_BASE_URL ??
    "http://127.0.0.1:8000";
  return raw.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

export function getApiV1Base(): string {
  return `${getApiOrigin()}/api/v1`;
}
