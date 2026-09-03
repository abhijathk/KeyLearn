/**
 * A timer that re-reads its interval on every tick, so a sweep whose
 * period is a control-centre setting (data snapshot, deletion sweep, staff
 * roster refresh) follows a change without a restart. Returns the stop.
 */
export function repeat(intervalMs: () => number, tick: () => void): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  const schedule = () => {
    if (stopped) {
      return;
    }
    timer = setTimeout(
      () => {
        tick();
        schedule();
      },
      Math.max(1000, intervalMs()),
    );
    timer.unref?.();
  };
  schedule();
  return () => {
    stopped = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
