import { type ReactNode } from "react";
import * as styles from "./CoursePane.module.less";

/**
 * The five reassurances a child is shown, each with its own drawn mark.
 *
 * Drawn rather than lettered, and never an emoji: an emoji is whatever the
 * device decides it is, which on a page built for a six-year-old means a
 * different picture on every machine. These are the same five strokes
 * everywhere.
 *
 * Each says its own row rather than decorating it — a circling arrow for "as
 * many times as you like", a clock for "shorter than a song", a tent for the
 * trail, a companion for Skelty, a bookmark for "nothing is lost".
 */
export type GuideIconName = "again" | "clock" | "tent" | "friend" | "bookmark";

const PATHS: Readonly<Record<GuideIconName, readonly string[]>> = {
  again: ["M4 12a8 8 0 1 0 3-6.2", "M4 4v4h4"],
  clock: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16", "M12 8v4l3 2"],
  tent: ["M5 19l7-14 7 14z"],
  friend: [
    "M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    "M4 20c0-3 2.5-5 5-5s5 2 5 5",
    "M16 8l2 2 4-4",
  ],
  bookmark: ["M6 4h12v16l-6-4-6 4z"],
};

export function GuideIcon({
  name,
  colour,
}: {
  readonly name: GuideIconName;
  readonly colour: string;
}): ReactNode {
  return (
    <span className={styles.kidIcon} style={{ background: colour }}>
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        {PATHS[name].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
