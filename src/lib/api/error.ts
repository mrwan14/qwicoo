export function errorDetail(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  if ("detail" in error) {
    const detail = error.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail && typeof detail === "object" && "detail" in detail) {
      const nested = detail.detail;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item ? String(item.msg) : "",
        )
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
    }
  }
  return fallback;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asApiError(error: unknown, response: Response, fallback: string): ApiError {
  return new ApiError(response.status, errorDetail(error, fallback));
}
