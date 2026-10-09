/** Class names that move. Reduced motion drops them so the landing stays still. */
export const MOTION_CLASSES = ["qw-drift", "qw-strip-in", "qw-pulse", "qw-rv", "qw-bar", "qw-bub"] as const;

const MOTION = new Set<string>(MOTION_CLASSES);

export function withoutMotion(reduced: boolean, className: string): string {
  if (!reduced) return className;
  return className
    .split(/\s+/)
    .filter((token) => token && !MOTION.has(token))
    .join(" ");
}
