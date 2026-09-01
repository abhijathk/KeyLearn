import { type LessonKey, type LessonKeys } from "@keylearn/lesson";
import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./LetterJourney.module.less";
import { useKeyStyles } from "./styles.ts";

const CAP_W = 30;
const CAP_H = 26;
const STEP = 42; // cap width + gap between stops
const PAD = 24; // side padding (>= CAP_W / 2)
const PAD_TOP = 28; // room for the focused key's note above the first lane
const ROW_H = 52;

/**
 * The Letter Journey: every key laid out in unlock order as a keycap sitting on
 * a straight road — no curves. The road you've travelled is solid; the road
 * ahead (locked keys) is dashed with ghosted caps. Each unlocked cap is tinted
 * by its confidence (slow → fast) with a matching coloured border, and the
 * current key is ringed in the accent with how close it is to unlocking noted
 * above. The whole thing wraps into stacked straight lanes to fit the width.
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

  // A Latin-sized alphabet (English is 26) always rides a single line — the SVG
  // scales to fit the width. Only the big scripts (Devanagari, Malayalam, …)
  // wrap, into balanced lanes sized to the available width.
  const ONE_LINE_MAX = 30;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availWidth, setAvailWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (el == null) {
      return;
    }
    const measure = () => {
      setAvailWidth(el.clientWidth || 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  let per = Math.max(1, n);
  if (n > ONE_LINE_MAX && availWidth > 0) {
    const fit = Math.floor((availWidth - 72 - PAD * 2) / STEP) + 1;
    const maxPer = Math.max(10, Number.isFinite(fit) ? fit : n);
    const laneRows = Math.max(1, Math.ceil(n / maxPer));
    per = Math.ceil(n / laneRows); // balance the lanes
  }
  const rows = Math.max(1, Math.ceil(n / per));
  const laneLen = Math.min(n, per);
  const width = PAD * 2 + Math.max(0, laneLen - 1) * STEP;
  const height = PAD_TOP + rows * ROW_H;
  const pos = (i: number) => {
    const row = Math.floor(i / per);
    return { x: PAD + (i - row * per) * STEP, y: PAD_TOP + row * ROW_H, row };
  };
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
  // Readiness notes need breathing room: when several focused keys sit close
  // together their labels would overlap, so only keys at least three stops
  // apart (left to right) get the text — the rest keep just their pin.
  const noted = new Set<number>();
  {
    let last = -Infinity;
    keys.forEach((key, i) => {
      if (key.isFocused && i - last >= 3) {
        noted.add(i);
        last = i;
      }
    });
  }

  return (
    <div id={id} ref={wrapRef} className={clsx(styles.journey, className)}>
      <svg
        className={styles.map}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* the road: a segment between each pair of same-lane neighbours */}
        {keys.slice(1).map((b, idx) => {
          const i = idx + 1;
          const a = keys[i - 1];
          const pa = pos(i - 1);
          const pb = pos(i);
          if (pa.row !== pb.row) {
            return null;
          }
          const enabled = a.isIncluded && b.isIncluded;
          const segColor =
            enabled && a.confidence != null && b.confidence != null
              ? String(confidenceColor((confOf(a) + confOf(b)) / 2))
              : undefined;
          return (
            <line
              key={`seg${i}`}
              className={enabled ? styles.seg : styles.segAhead}
              x1={pa.x + CAP_W / 2}
              y1={pa.y}
              x2={pb.x - CAP_W / 2}
              y2={pb.y}
              style={segColor != null ? { stroke: segColor } : undefined}
            />
          );
        })}
        {/* the caps */}
        {keys.map((key, i) => {
          const {
            letter: { codePoint, label },
            confidence,
            isIncluded,
            isFocused,
          } = key;
          const conf = confOf(key);
          const { x, y } = pos(i);
          const color =
            isIncluded && confidence != null
              ? String(confidenceColor(conf))
              : undefined;
          // Tint the cap by its confidence (a subtle fill). The current key is
          // fully styled from CSS — a solid accent chip — so no inline fill.
          const capStyle =
            color != null && !isFocused
              ? {
                  fill: `color-mix(in oklab, ${color} 20%, var(--primary-l1))`,
                  stroke: color,
                }
              : undefined;
          const nx = Math.max(CAP_W, Math.min(width - CAP_W, x));
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
                  {noted.has(i) &&
                    (() => {
                      // The note is wider than the chip it belongs to, and on
                      // any row but the first it is drawn across the lane
                      // above. A backing plate keeps it legible instead of
                      // letting it tangle with the letters behind it.
                      const note = readinessNote(readyOf(key));
                      const w = note.length * 7.2 + 12;
                      const ny = y - CAP_H / 2 - 10;
                      return (
                        <>
                          <rect
                            className={styles.notePlate}
                            x={nx - w / 2}
                            y={ny - 11}
                            width={w}
                            height={15}
                            rx={4}
                          />
                          <text className={styles.note} x={nx} y={ny}>
                            {note}
                          </text>
                        </>
                      );
                    })()}
                  <path
                    className={styles.pin}
                    d={`M ${nx - 5} ${y - CAP_H / 2 - 6} L ${nx + 5} ${y - CAP_H / 2 - 6} L ${nx} ${y - CAP_H / 2 - 1} Z`}
                  />
                </>
              )}
              <rect
                className={styles.cap}
                x={x - CAP_W / 2}
                y={y - CAP_H / 2}
                width={CAP_W}
                height={CAP_H}
                rx={5}
                style={capStyle}
              />
              <text className={styles.label} x={x} y={y + 4.5}>
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
    // NOT "ready to unlock": this letter is already unlocked and already at
    // the bar — what is about to happen is that the NEXT letter opens. The old
    // wording read as an instruction to go and unlock something, which is why
    // it was reported as confusing.
    return "next letter unlocking";
  }
  if (confidence <= 0) {
    return "you are here";
  }
  return `${Math.round(confidence * 100)}% ready`;
}
