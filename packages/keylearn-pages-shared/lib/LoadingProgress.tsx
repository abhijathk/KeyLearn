import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import * as styles from "./LoadingProgress.module.less";

/**
 * How long the stylesheet holds the loader back before fading it in. Kept in
 * step with `animation-delay` in LoadingProgress.module.less.
 */
const HELD_BACK_MS = 200;

/**
 * How long after one loader leaves the screen another still counts as the
 * same wait. Long enough to bridge the handoff between two Suspense
 * boundaries resolving one after the other; far shorter than the gap between
 * two things a person would call separate loads.
 */
const SAME_WAIT_MS = 500;

/**
 * When a loader was last actually on screen — not merely mounted — and how
 * many gates of this wait have already been cleared.
 *
 * Module-level on purpose. The loaders in a chain are different elements at
 * different positions in the tree, so React cannot reconcile them and there
 * is no component state they can share; the only thing they have in common
 * is that a person is looking at the same wait.
 */
let lastVisibleAt = 0;
let gatesCleared = 0;

/**
 * Where the bar sits after clearing `n` gates, when nothing has told us how
 * much work is really left.
 *
 * Each gate closes a shrinking fraction of the remaining distance, so the bar
 * always advances and never arrives: 0%, 40%, 64%, 78%, 87%… A guessed bar
 * that reaches the end while the page is still blank is worse than no bar at
 * all — it turns "this is taking a while" into "this is broken". Real
 * numbers, when a gate has them, override this entirely.
 */
function estimate(n: number): number {
  return (1 - 0.6 ** n) * 100;
}

/**
 * The KeyLearn loading state: three keycaps typing "K E Y", coloured from the
 * keyboard's finger-zone palette, plus a slim progress track.
 *
 * **Why this knows about the loader before it.** Reaching the practice page
 * crosses four loading gates in sequence — the route's own Suspense while the
 * chunk downloads, then LessonLoader while the model arrives, then
 * ProgressUpdater while progress is computed. Each renders its own instance
 * of this component, so each is a fresh mount, and each restarted the 200ms
 * hold-back from zero. The page was therefore blank for 200ms *between* every
 * pair of gates: the loader appeared, vanished, appeared, vanished. Four
 * gates, three or four blinks.
 *
 * The hold-back is right for the first gate and wrong for the rest. A wait
 * short enough not to deserve a loading state still deserves none — but once
 * one has been shown, the next gate is a continuation of the same wait, not a
 * new one, and it should pick up exactly where the last left off. That is
 * what `continuing` does, and the track is the other half of it: one bar that
 * advances across the whole sequence, rather than four separate loaders each
 * starting from nothing.
 */
export function LoadingProgress({
  total = 0,
  current = 0,
}: {
  readonly total?: number;
  readonly current?: number;
}): ReactNode {
  // Both decided once, at mount, and held in state so a re-render cannot
  // restart the animation or make the bar jump backwards mid-wait.
  const [{ continuing, step }] = useState(() => {
    const isSameWait = Date.now() - lastVisibleAt < SAME_WAIT_MS;
    if (!isSameWait) {
      // A new wait: the bar starts again from the left.
      gatesCleared = 0;
    }
    return { continuing: isSameWait, step: gatesCleared };
  });

  useEffect(() => {
    const mountedAt = Date.now();
    return () => {
      // Only if this one actually became visible. A gate that resolves inside
      // the hold-back showed nothing, so it must not persuade the next gate
      // that a loader is already on screen — otherwise a chain of fast loads
      // would flash one up instantly, which is the very thing the hold-back
      // exists to prevent. It has not moved the bar either, for the same
      // reason: nobody saw it.
      if (Date.now() - mountedAt >= HELD_BACK_MS) {
        lastVisibleAt = Date.now();
        gatesCleared += 1;
      }
    };
  }, []);

  // A gate that knows its real numbers wins. Only ProgressUpdater does, and
  // only for its own share of the wait — but a measured figure beats an
  // inferred one, so it is used unchanged rather than blended into the
  // estimate.
  const measured =
    total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : null;
  const pct = measured ?? estimate(step);

  return (
    <div className={`${styles.root} ${continuing ? styles.continuing : ""}`}>
      <div className={styles.loader}>
        <div className={styles.keys}>
          <span className={`${styles.key} ${styles.k1}`}>K</span>
          <span className={`${styles.key} ${styles.k2}`}>E</span>
          <span className={`${styles.key} ${styles.k3}`}>Y</span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          // Announced only when it is a real measurement. A screen reader
          // reading out a number this component invented would be stating a
          // fact it does not have.
          aria-valuenow={measured == null ? undefined : Math.round(measured)}
        >
          <i style={{ inlineSize: `${pct}%` } as CSSProperties} />
        </div>
      </div>
    </div>
  );
}
