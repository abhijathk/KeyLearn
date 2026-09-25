import { onSiteConfigRefresh } from "./cache.ts";

/**
 * A timer that re-reads its interval on every tick, so a sweep whose
 * period is a control-centre setting (data snapshot, deletion sweep, staff
 * roster refresh) follows a change without a restart. Returns the stop.
 *
 * It also re-reads it whenever the site configuration is reloaded, and
 * moves the pending tick if the answer changed. The first tick is scheduled
 * at boot, before the stored values have loaded, when every setting still
 * reads as its default — so without this a deletion sweep set to every 15
 * minutes waited the default hour for its first run, and any change waited
 * out whatever tick was already pending.
 */
export function repeat(
  intervalMs: () => number,
  tick: () => void,
  /**
   * Told the interval once it is the real one: after the first settings
   * load, which is when a period read at boot stops being the default. For
   * the "scheduled" log line, which otherwise named the default.
   */
  settled?: (intervalMs: number) => void,
): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  let since = Date.now();
  let delay = 0;
  const arm = (ms: number) => {
    timer = setTimeout(() => {
      tick();
      schedule();
    }, ms);
    timer.unref?.();
  };
  const schedule = () => {
    if (stopped) {
      return;
    }
    since = Date.now();
    delay = Math.max(1000, intervalMs());
    arm(delay);
  };
  schedule();
  let told = false;
  const unsubscribe = onSiteConfigRefresh(() => {
    if (stopped || timer == null) {
      return;
    }
    const wanted = Math.max(1000, intervalMs());
    if (!told) {
      told = true;
      settled?.(wanted);
    }
    if (wanted === delay) {
      return;
    }
    // Counted from when this wait began, as if it had been set right.
    clearTimeout(timer);
    delay = wanted;
    arm(Math.max(0, since + wanted - Date.now()));
  });
  return () => {
    stopped = true;
    unsubscribe();
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
