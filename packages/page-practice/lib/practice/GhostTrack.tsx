import { clsx } from "clsx";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./GhostTrack.module.less";
import { type LessonState } from "./state/index.ts";

/**
 * A race against your own best pace, sitting just above the keyboard like part
 * of it. A ghost marker crosses the current text at the fastest pace you've
 * reached so far while your marker tracks what you actually type, and the lane
 * between them fills green when you're ahead or amber when you're behind — so
 * you can see at a glance whether you're gaining on your past self.
 */
export function GhostTrack({ state }: { readonly state: LessonState }): ReactNode {
  const bestCps = state.summaryStats.speed.max / 60; // best pace, chars/sec
  const total = state.textInput.length;
  const typed = Math.max(0, total - state.suffix.length);
  const youFrac = total > 0 ? Math.min(1, typed / total) : 0;

  const [ghostFrac, setGhostFrac] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (typed === 0) {
      startRef.current = null;
      setGhostFrac(0);
    }
  }, [typed]);

  const racing = typed > 0 && youFrac < 1 && bestCps > 0 && total > 0;
  useEffect(() => {
    if (!racing) {
      return;
    }
    if (startRef.current == null) {
      startRef.current = performance.now();
    }
    const tick = () => {
      const elapsed = (performance.now() - startRef.current!) / 1000;
      setGhostFrac(Math.min(1, (bestCps * elapsed) / total));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [racing, bestCps, total]);

  if (bestCps <= 0) {
    return null; // Nothing to race against until there's a personal best.
  }

  const ahead = youFrac >= ghostFrac;
  const lo = Math.min(youFrac, ghostFrac);
  const hi = Math.max(youFrac, ghostFrac);
  const started = typed > 0;

  return (
    <div className={styles.track} aria-hidden={true}>
      <div className={styles.rail}>
        {started && (
          <div
            className={clsx(styles.gap, ahead ? styles.gapAhead : styles.gapBehind)}
            style={{
              insetInlineStart: `${lo * 100}%`,
              inlineSize: `${(hi - lo) * 100}%`,
            }}
          />
        )}
        <div
          className={clsx(styles.puck, styles.ghost)}
          style={{ insetInlineStart: `${ghostFrac * 100}%` }}
        >
          <span className={styles.tag}>
            <FormattedMessage id="t_ghost_best" defaultMessage="best" />
          </span>
        </div>
        <div
          className={clsx(styles.puck, styles.you, ahead && styles.winning)}
          style={{ insetInlineStart: `${youFrac * 100}%` }}
        >
          <span className={styles.tag}>
            <FormattedMessage id="t_ghost_you" defaultMessage="you" />
          </span>
        </div>
      </div>
    </div>
  );
}
