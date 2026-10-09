/** Paths the staff proxy may call without a session, and without attaching a bearer token. */
export function isPublicAssistantPath(path: readonly string[]): boolean {
  return path[0] === "assistant" && path[1] === "public";
}

/** Public assistant routes never receive Authorization, even when a staff cookie is present. */
export function staffAuthorization(path: readonly string[], token: string | undefined): string | null {
  if (isPublicAssistantPath(path) || !token) return null;
  return `Bearer ${token}`;
}
