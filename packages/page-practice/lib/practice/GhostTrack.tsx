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
 * A race against your own best run, sitting on top of the keyboard like part
 * of it. The ghost marker replays the pace curve of your fastest run this
 * session — reproducing its speed-ups and slow-downs — while your marker
 * tracks what you type now. The lane between them fills green when you're
 * ahead or amber when behind, so you can see whether you're gaining on your
 * past self. Before a full run exists it falls back to a steady best-pace line.
 */
export function GhostTrack({ state }: { readonly state: LessonState }): ReactNode {
  const marks = state.bestRunMarks;
  const bestCps = state.summaryStats.speed.max / 60; // fallback pace, chars/sec
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

  const hasGhost = (marks != null && marks.length >= 2) || bestCps > 0;
  const racing = typed > 0 && youFrac < 1 && total > 0 && hasGhost;
  useEffect(() => {
    if (!racing) {
      return;
    }
    if (startRef.current == null) {
      startRef.current = performance.now();
    }
    const tick = () => {
      const elapsedMs = performance.now() - startRef.current!;
      let frac: number;
      if (marks != null && marks.length >= 2) {
        // Replay: how far along the best run was at this elapsed time.
        let k = 0;
        while (k < marks.length && marks[k] <= elapsedMs) {
          k += 1;
        }
        frac = k / marks.length;
      } else {
        frac = (bestCps * (elapsedMs / 1000)) / total;
      }
      setGhostFrac(Math.min(1, frac));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [racing, marks, bestCps, total]);

  if (!hasGhost) {
    return null; // Nothing to race against until there's a personal best.
  }

  const ahead = youFrac >= ghostFrac;
  const started = typed > 0;
  const lo = Math.min(youFrac, ghostFrac);
  const hi = Math.max(youFrac, ghostFrac);

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
