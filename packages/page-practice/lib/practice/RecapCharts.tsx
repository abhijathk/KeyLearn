import { type LessonKey } from "@keylearn/lesson";
import { type Result } from "@keylearn/result";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import * as styles from "./RecapCharts.module.less";

/**
 * The small pictures in the session recap.
 *
 * Each of these draws something the panel already knew but was only stating in
 * words. "steady" is a claim; a line is evidence. "9/26" is arithmetic; a grid
 * is a finish line. Nothing here computes anything new — every input is already
 * to hand in the recap.
 *
 * They are all built to hold their shape when empty, so the panel does not jump
 * about as the first few lessons arrive.
 */

/** One mark per lesson this sitting: mint for a clean run, coral where it slipped. */
export const SessionMarks = memo(function SessionMarks({
  session,
  slots = 8,
}: {
  readonly session: readonly Result[];
  readonly slots?: number;
}): ReactNode {
  // Keep the last few, but always draw the full row so the card keeps its
  // height from the very first visit.
  const shown = session.slice(-slots);
  const blanks = Math.max(0, slots - shown.length);
  return (
    <span className={styles.marks} aria-hidden={true}>
      {shown.map((result, i) => (
        <i
          key={i}
          className={clsx(
            styles.mark,
            result.accuracy >= 0.97 ? styles.markOn : styles.markMiss,
          )}
        />
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        <i key={`b${i}`} className={styles.mark} />
      ))}
    </span>
  );
});

/** How far into today's goal, as a ring. */
export const GoalRing = memo(function GoalRing({
  value,
}: {
  readonly value: number;
}): ReactNode {
  const r = 17;
  const c = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, value));
  return (
    <svg className={styles.ring} viewBox="0 0 40 40" aria-hidden={true}>
      <circle className={styles.ringTrack} cx="20" cy="20" r={r} />
      {done > 0 && (
        <circle
          className={styles.ringArc}
          cx="20"
          cy="20"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done)}
          transform="rotate(-90 20 20)"
        />
      )}
    </svg>
  );
});

/**
 * Speed over the recent lessons, with the average as a baseline.
 *
 * The baseline is the point: a line on its own floats, and the reader cannot
 * tell whether the last run was good. Against the average they can.
 */
export const SpeedSpark = memo(function SpeedSpark({
  speeds,
}: {
  readonly speeds: readonly number[];
}): ReactNode {
  const W = 100;
  const H = 30;
  if (speeds.length < 2) {
    // The same box, with a flat rule — so the card is the right height before
    // there is anything to plot.
    return (
      <svg
        className={styles.spark}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden={true}
      >
        <line
          className={styles.sparkEmpty}
          x1="0"
          y1={H / 2}
          x2={W}
          y2={H / 2}
        />
      </svg>
    );
  }
  const lo = Math.min(...speeds);
  const hi = Math.max(...speeds);
  // A flat run would divide by zero and, worse, draw a line at the top of the
  // box as though it were a peak. Pad the range so it sits in the middle.
  const pad = hi - lo < 1e-6 ? 1 : (hi - lo) * 0.15;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (i / (speeds.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = speeds.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const avg = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  const last = speeds[speeds.length - 1];
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden={true}
    >
      <line
        className={styles.sparkBase}
        x1="0"
        y1={y(avg)}
        x2={W}
        y2={y(avg)}
      />
      <path
        className={styles.sparkFill}
        d={`M${line.join(" L")} L${W},${H} L0,${H} Z`}
      />
      <path className={styles.sparkLine} d={`M${line.join(" L")}`} />
      <circle className={styles.sparkEnd} cx={W} cy={y(last)} r="2.2" />
    </svg>
  );
});

/**
 * The whole alphabet as a grid: filled for unlocked, outlined for the one being
 * learned now. A visible finish line pulls a learner forward in a way a
 * fraction does not.
 */
export const AlphabetGrid = memo(function AlphabetGrid({
  keys,
  focused,
}: {
  readonly keys: readonly LessonKey[];
  readonly focused: LessonKey | null;
}): ReactNode {
  // Fixed at 2 rows: some scripts have 50+ letters, and the card can't grow
  // taller without breaking alignment with its siblings, so extra letters
  // shrink the tiles instead (more columns) rather than adding rows.
  const columns = Math.max(13, Math.ceil(keys.length / 2));
  return (
    <span
      className={styles.alpha}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      aria-hidden={true}
    >
      {keys.map((key) => (
        <i
          key={String(key.letter.codePoint)}
          className={clsx(
            styles.cell,
            key.letter.codePoint === focused?.letter.codePoint
              ? styles.cellNext
              : key.isIncluded && styles.cellGot,
          )}
        />
      ))}
    </span>
  );
});

/** The keys currently costing the most time, as small caps. */
export const SlowKeys = memo(function SlowKeys({
  keys,
  count = 3,
}: {
  readonly keys: readonly LessonKey[];
  readonly count?: number;
}): ReactNode {
  const slowest = keys
    .filter((key) => key.timeToType != null)
    .sort((a, b) => (b.timeToType ?? 0) - (a.timeToType ?? 0))
    .slice(0, count);
  if (slowest.length === 0) {
    return null;
  }
  return (
    <span className={styles.chips}>
      {slowest.map((key) => (
        <span key={String(key.letter.codePoint)} className={styles.chip}>
          {String(key.letter.label)}
        </span>
      ))}
    </span>
  );
});
