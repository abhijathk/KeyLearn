import { clsx } from "clsx";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type LessonState } from "./state/index.ts";
import * as styles from "./GhostTrack.module.less";

/**
 * A race against your own best pace. A ghost puck crosses the current text at
 * the fastest speed you've reached so far, while your puck advances with what
 * you actually type — so you get an at-a-glance "am I beating my best?" during
 * every round. Reuses the timing you already record; nothing is persisted.
 */
export function GhostTrack({ state }: { readonly state: LessonState }): ReactNode {
  // Best pace so far, in characters per second.
  const bestCps = state.summaryStats.speed.max / 60;
  const total = state.textInput.length;
  const typed = Math.max(0, total - state.suffix.length);
  const youFrac = total > 0 ? Math.min(1, typed / total) : 0;

  const [ghostFrac, setGhostFrac] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // A new round resets to the start line.
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

  // Nothing to race against until there's a personal best.
  if (bestCps <= 0) {
    return null;
  }

  const ahead = youFrac >= ghostFrac;
  return (
    <div className={styles.track} aria-hidden={true}>
      <div className={styles.rail}>
        <div
          className={clsx(styles.puck, styles.ghost)}
          style={{ insetInlineStart: `${ghostFrac * 100}%` }}
        />
        <div
          className={clsx(styles.puck, styles.you, ahead && styles.winning)}
          style={{ insetInlineStart: `${youFrac * 100}%` }}
        />
      </div>
    </div>
  );
}
