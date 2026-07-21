import { type LessonKey, type LessonKeys } from "@keybr/lesson";
import { type ClassName } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import * as styles from "./LetterJourney.module.less";
import { useKeyStyles } from "./styles.ts";

const STEP = 42;
const PAD = 26;
const MID = 48;
const AMP = 10;
const HEIGHT = 98;
const RING = 14;

/**
 * The Letter Journey drawn as a trail on a map. Each letter is a stop along a
 * winding path in unlock order; a stop's colour is the slow→fast confidence
 * blend and the link between two unlocked stops is coloured the same way, so
 * both the letters and the connections between them show what's strong and
 * what's weak. The current key is a big dot ringed by a progress arc (how
 * close it is to unlocking); everything is grey until there's data.
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
  const width = PAD * 2 + (n - 1) * STEP;
  const points = keys.map((_, i) => ({
    x: PAD + i * STEP,
    y: MID + AMP * Math.sin(i * 0.55),
  }));
  const confOf = (k: LessonKey) => Math.max(0, Math.min(1, k.confidence ?? 0));

  return (
    <div id={id} className={clsx(styles.journey, className)}>
      <svg
        className={styles.map}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
      >
        {keys.slice(0, n - 1).map((a, i) => {
          const b = keys[i + 1];
          const enabled = a.isIncluded && b.isIncluded;
          const hasData = a.confidence != null && b.confidence != null;
          const color =
            enabled && hasData
              ? String(confidenceColor((confOf(a) + confOf(b)) / 2))
              : undefined;
          const p0 = points[i];
          const p1 = points[i + 1];
          const cx = (p0.x + p1.x) / 2;
          return (
            <path
              key={i}
              className={enabled ? styles.link : styles.road}
              d={`M ${p0.x} ${p0.y} C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`}
              style={color ? { stroke: color } : undefined}
            />
          );
        })}
        {keys.map((key, i) => {
          const {
            letter: { codePoint, label },
            confidence,
            isIncluded,
            isFocused,
          } = key;
          const conf = confOf(key);
          const { x, y } = points[i];
          // Algorithm colour once there's data; grey (from CSS) until then.
          const color =
            isIncluded && confidence != null
              ? String(confidenceColor(conf))
              : undefined;
          return (
            <g
              key={codePoint}
              className={clsx(
                styles.stop,
                isFocused
                  ? styles.here
                  : isIncluded
                    ? styles.done
                    : styles.locked,
              )}
              onMouseEnter={(ev) => {
                onKeyHoverIn?.(key, ev.currentTarget);
              }}
              onMouseLeave={(ev) => {
                onKeyHoverOut?.(key, ev.currentTarget);
              }}
            >
              {isFocused && (
                <>
                  <text className={styles.note} x={x} y={y - 28}>
                    {readinessNote(conf)}
                  </text>
                  <path
                    className={styles.pin}
                    d={`M ${x - 6} ${y - 25} L ${x + 6} ${y - 25} L ${x} ${y - 16} Z`}
                  />
                  <circle className={styles.ring} cx={x} cy={y} r={RING} />
                  <circle
                    className={styles.ringProgress}
                    cx={x}
                    cy={y}
                    r={RING}
                    transform={`rotate(-90 ${x} ${y})`}
                    style={{
                      strokeDasharray: `${(conf * 2 * Math.PI * RING).toFixed(1)} 999`,
                    }}
                  />
                </>
              )}
              <circle
                className={styles.dot}
                cx={x}
                cy={y}
                r={isFocused ? 9 : isIncluded ? 7 : 4.5}
                style={color ? { fill: color } : undefined}
              />
              <text className={styles.label} x={x} y={HEIGHT - 8}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <span className={styles.count}>
        {unlocked}
        <i>/{n}</i>
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
