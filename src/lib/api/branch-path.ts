const BRANCH_PATH = /\/api\/v1\/branches\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/** The branch a URL is about, e.g. /api/v1/branches/{id}/financial-settings. */
export function branchFromPath(url: string): string | null {
  return BRANCH_PATH.exec(url)?.[1] ?? null;
}
