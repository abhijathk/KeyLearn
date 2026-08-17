const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * A short "2h ago" / "3d ago" style string for the staff roster's last
 * sign-in column — no `Intl.RelativeTimeFormat` here, the roster only ever
 * needs a handful of coarse buckets, not full locale-aware phrasing.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  if (ms < MINUTE_MS) {
    return "just now";
  }
  if (ms < HOUR_MS) {
    return `${Math.floor(ms / MINUTE_MS)}m ago`;
  }
  if (ms < DAY_MS) {
    return `${Math.floor(ms / HOUR_MS)}h ago`;
  }
  return `${Math.floor(ms / DAY_MS)}d ago`;
}
