/** Browser-visible API origin. `API_BASE_URL` is not inlined into client bundles. */
function mediaOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
}

function isAbsoluteHttp(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Turn a stored `/media/...` path into a fetchable URL. Absolute http(s) and blob previews stay as-is. */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (isAbsoluteHttp(path) || path.startsWith("blob:")) return path;
  return `${mediaOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Presigned PUT target. Absolute R2 URLs are used as-is; relative paths are prefixed with the public API origin. */
export function presignedUploadUrl(uploadUrl: string): string {
  if (isAbsoluteHttp(uploadUrl)) return uploadUrl;
  return `${mediaOrigin()}${uploadUrl.startsWith("/") ? uploadUrl : `/${uploadUrl}`}`;
}
