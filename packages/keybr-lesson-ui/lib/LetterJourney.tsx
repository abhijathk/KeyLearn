import { type LessonKey, type LessonKeys } from "@keybr/lesson";
import { type ClassName } from "@keybr/widget";
import { clsx } from "clsx";
import { Fragment, type ReactNode } from "react";
import * as styles from "./LetterJourney.module.less";
import { useKeyStyles } from "./styles.ts";

/**
 * The Letter Journey: the alphabet drawn as a line of mini keycaps in unlock
 * order. Unlocked caps are filled with the engine's confidence colour and wear
 * a hairline gauge; the current focus key is ringed and glowing with a
 * readiness note; keys still ahead are quiet outline stops. A small counter
 * at the end tells how many keys are unlocked.
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
  const unlocked = keys.filter(({ isIncluded }) => isIncluded).length;
  return (
    <div id={id} className={clsx(styles.journey, className)}>
      {keys.map((key, index) => {
        const {
          letter: { codePoint, label },
          confidence,
          isIncluded,
          isFocused,
        } = key;
        const conf = Math.max(0, Math.min(1, confidence ?? 0));
        const state = isFocused
          ? styles.here
          : isIncluded
            ? styles.done
            : styles.locked;
        // Algorithm-driven colour: the same slow->fast confidence blend the
        // engine uses everywhere else paints each unlocked cap, including
        // the current focus key.
        const dotStyle =
          (isIncluded || isFocused) && confidence != null
            ? { backgroundColor: String(confidenceColor(conf)) }
            : undefined;
        return (
          <Fragment key={codePoint}>
            {index > 0 && (
              <i className={clsx(styles.link, isIncluded && styles.linkOn)} />
            )}
            <div
              className={clsx(styles.node, state)}
              data-note={isFocused ? readinessNote(conf) : undefined}
              onMouseEnter={(ev) => {
                onKeyHoverIn?.(key, ev.currentTarget);
              }}
              onMouseLeave={(ev) => {
                onKeyHoverOut?.(key, ev.currentTarget);
              }}
            >
              <span className={styles.dot} style={dotStyle}>
                {label}
                {(isIncluded || isFocused) && confidence != null && (
                  <span className={styles.gauge}>
                    <i style={{ inlineSize: `${Math.round(conf * 100)}%` }} />
                  </span>
                )}
              </span>
            </div>
          </Fragment>
        );
      })}
      <span className={styles.count}>
        {unlocked}/{keys.length}
      </span>
    </div>
  );
}

function readinessNote(confidence: number): string {
  if (confidence >= 1) {
    return "ready to unlock";
  }
  if (confidence <= 0) {
    return "you are here";
  }
  return `${Math.round(confidence * 100)}% ready`;
}
