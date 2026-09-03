import { type LessonKey, type LessonKeys } from "@keylearn/lesson";
import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import * as styles from "./LetterJourney.module.less";
import { useKeyStyles } from "./styles.ts";

/**
 * The Letter Journey: every key in unlock order, as letters rather than keys.
 *
 * It used to draw twenty-six keycaps on a road, and it sat directly beneath a
 * keyboard made of keycaps — so the eye read it as a second, broken keyboard
 * and had to work out that it was not one. The information was never the
 * problem; the boxes were. Drawn as type, the same row reads as a caption to
 * the board above instead of a rival to it (owner, 4 Sep 2026).
 *
 * Nothing was given up to do it. Confidence still shows, now as the colour of
 * the letter itself rather than the fill of a chip behind it; the key in play
 * carries the accent and a rule beneath it; every letter is still its own
 * hover target, so the detail popup works exactly as before. The row wraps on
 * its own, which is also how the big scripts (Devanagari, Malayalam) stopped
 * needing the lane arithmetic this component used to carry.
 */
export function LetterJourney({
  id,
  className,
  lessonKeys,
  onKeyHoverIn,
  onKeyHoverOut,
}: {
  readonly id?: string;
  readonly className?: ClassName;
  readonly lessonKeys: LessonKeys;
  readonly onKeyHoverIn?: (key: LessonKey, elem: Element) => void;
  readonly onKeyHoverOut?: (key: LessonKey, elem: Element) => void;
}): ReactNode {
  const { confidenceColor } = useKeyStyles();
  const keys = [...lessonKeys];
  const n = keys.length;
  const unlocked = keys.filter(({ isIncluded }) => isIncluded).length;

  const confOf = (k: LessonKey) => Math.max(0, Math.min(1, k.confidence ?? 0));
  /**
   * How close this key is to letting the next letter through.
   *
   * Deliberately the BEST confidence, not the current one, because that is what
   * the unlock gate actually reads: a new letter arrives once every key in play
   * has *at some point* been typed at the target speed. Showing the live figure
   * here meant "64% ready" could sit beside a key that had already cleared the
   * bar, and a learner watching that number had no way to tell what was holding
   * them up.
   */
  const readyOf = (k: LessonKey) =>
    Math.max(0, Math.min(1, k.bestConfidence ?? 0));

  /**
   * Where the readiness words go: above the key they are about.
   *
   * Not spliced between two letters, which breaks the unlock order the row
   * exists to show, and not parked at the end, where they dangle after the
   * alphabet belonging to nothing. They sit over the key in play and point at
   * it, which is the only position that needs no explaining. They are drawn
   * out of flow, so the row's height and the letter spacing do not move.
   *
   * Only the first key in play is captioned. Several can be focused at once,
   * and a caption over each turned one line into a thicket.
   */
  const firstFocused = keys.findIndex(({ isFocused }) => isFocused);

  return (
    <div id={id} className={clsx(styles.journey, className)}>
      <div className={styles.letters}>
        {keys.map((key, i) => {
          const {
            letter: { codePoint, label },
            confidence,
            isIncluded,
            isFocused,
          } = key;
          // The letter is tinted by how confident this key is, so the row still
          // shows at a glance which of the cleared letters are the slow ones.
          // The key in play takes the accent from CSS instead.
          const tint =
            isIncluded && confidence != null && !isFocused
              ? String(confidenceColor(confOf(key)))
              : undefined;
          return (
            <span key={codePoint} className={styles.stop}>
              <span
                className={clsx(
                  styles.glyph,
                  isFocused
                    ? styles.here
                    : isIncluded
                      ? styles.done
                      : styles.locked,
                )}
                style={tint != null ? { color: tint } : undefined}
                onMouseEnter={(ev) => {
                  onKeyHoverIn?.(key, ev.currentTarget);
                }}
                onMouseLeave={(ev) => {
                  onKeyHoverOut?.(key, ev.currentTarget);
                }}
              >
                {label}
              </span>
              {isFocused && i === firstFocused && (
                <span className={styles.note}>
                  {readinessNote(readyOf(key))}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <span className={styles.count}>
        {unlocked}
        <i>/{n}</i>
      </span>
    </div>
  );
}

/**
 * The caption over the key in play. One short line, always.
 *
 * It used to read "next letter unlocking", which is the right sentence and
 * the wrong place for it: three words stacked over a single letter wrapped
 * to three lines and reached out past the alphabet. The words survive in the
 * hover card, where there is room; here the caption says only how close this
 * key is, which is the part that changes and the part worth watching.
 *
 * "Unlocking" rather than "100%" at the top of the range, because what
 * happens at the bar is not a number going up — it is the next letter
 * arriving, and that is the thing a learner is waiting for.
 */
function readinessNote(confidence: number): string {
  if (confidence >= 1) {
    return "unlocking";
  }
  if (confidence <= 0) {
    return "here";
  }
  return `${Math.round(confidence * 100)}%`;
}
