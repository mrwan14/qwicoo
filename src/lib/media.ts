export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(
    /\/+$/,
    "",
  );
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
