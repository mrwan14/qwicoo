/** A count that eases in when it changes. Reduced motion already turns the animation off. */
export function LiveCount({ value }: { value: number }) {
  return (
    <span
      key={value}
      className="inline-block tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
    >
      {value}
    </span>
  );
}

/** Latest timestamp already present on a loaded list. Returns null when none parse. */
export function latestTimestamp(values: readonly (string | null | undefined)[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latest = value;
    }
  }
  return latest;
}
