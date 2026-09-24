import { type CSSProperties, type ReactNode } from "react";
import * as styles from "./KidsWindow.module.less";

/**
 * The shell shared by the kids Classic celebration windows — the unlock
 * ceremony and the daily-goal report in both its moods. Only the kids
 * flavour of those components renders it; the grown-up page keeps its own.
 */

export { styles as kidsWindowStyles };

export type KidsTone = "unlock" | "goal" | "rest";
export type KidsTint = "violet" | "blue" | "orange" | "green";

export function KidsWindow({
  tone,
  width,
  headHeight,
  head,
  children,
}: {
  readonly tone: KidsTone;
  /** Largest card width in rem; narrow windows get less (see the CSS). */
  readonly width: number;
  /**
   * Largest header band height in px — also sizes the streak artwork. Short
   * windows get a shorter band (see the CSS).
   */
  readonly headHeight: number;
  readonly head: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        style={{ "--kw-width": `${width}rem` } as CSSProperties}
      >
        <div
          className={styles.head}
          data-tone={tone}
          style={{ "--kw-head": `${headHeight / 16}rem` } as CSSProperties}
        >
          <Streaks height={headHeight} />
          <div className={styles.glow} />
          {head}
        </div>
        <div className={styles.scroll}>{children}</div>
      </div>
    </div>
  );
}

// Diagonal light streaks and a scatter of four-point sparkles, drawn to the
// band's own height so the streaks run corner to corner at any size.
function Streaks({ height: h }: { readonly height: number }): ReactNode {
  const streaks: [number, number, number][] = [
    [-60, 0.1, 26],
    [80, 0.07, 10],
    [360, 0.08, 34],
    [470, 0.06, 12],
    [560, 0.09, 20],
  ];
  const sparkles: [number, number, number, number][] = [
    [70, 38, 1, 0.9],
    [500, 51, 0.75, 0.8],
    [110, h - 47, 0.6, 0.7],
    [450, h - 61, 0.9, 0.85],
    [250, 20, 0.5, 0.6],
  ];
  return (
    <svg
      className={styles.streaks}
      viewBox={`0 0 600 ${h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {streaks.map(([x, opacity, width], i) => (
        <path
          key={i}
          d={`M${x} ${h + 20} L${x + 140} -20`}
          stroke="#fff"
          strokeOpacity={opacity}
          strokeWidth={width}
          strokeLinecap="round"
        />
      ))}
      <g className={styles.sparkles}>
        {sparkles.map(([x, y, s, opacity], i) => (
          <path key={i} d={sparkle(x, y, s)} fill="#fff" opacity={opacity} />
        ))}
      </g>
    </svg>
  );
}

function sparkle(x: number, y: number, s: number): string {
  const a = 3.4 * s;
  const b = 8.6 * s;
  return (
    `M${x} ${y}l${a} ${b} ${b} ${a} ${-b} ${a} ${-a} ${b} ` +
    `${-a} ${-b} ${-b} ${-a}z`
  );
}

export function KidsTile({
  tint,
  icon,
  label,
  value,
  unit,
  badge,
  small = false,
}: {
  readonly tint: KidsTint;
  readonly icon: ReactNode;
  readonly label: ReactNode;
  readonly value: string;
  readonly unit?: string;
  readonly badge?: ReactNode;
  readonly small?: boolean;
}): ReactNode {
  return (
    <div className={styles.tile} data-tint={tint}>
      <div className={styles.tileHead}>
        <span className={styles.tileIcon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.caption}>{label}</span>
      </div>
      <span
        className={
          small
            ? `${styles.tileValue} ${styles.tileValueSmall}`
            : styles.tileValue
        }
      >
        {value}
        {unit != null && unit !== "" && (
          <span className={styles.unit}>{unit}</span>
        )}
      </span>
      {badge != null && <span className={styles.badge}>{badge}</span>}
    </div>
  );
}

export function IconBolt(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

export function IconTarget(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconStar(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}

export function IconBook(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
    </svg>
  );
}

export function IconClock(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function IconHand(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 11V6a2 2 0 0 1 4 0v5M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v7a7 7 0 0 1-14 0v-3a2 2 0 0 1 4 0" />
    </svg>
  );
}

export function IconEye(): ReactNode {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    </svg>
  );
}
