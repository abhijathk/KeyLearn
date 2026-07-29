import { useKeyboard } from "@keybr/keyboard";
import { type CodePoint } from "@keybr/unicode";
import { memo, type ReactNode } from "react";
import * as styles from "./HeatRingLayer.module.less";
import { getKeyCenter, Surface } from "./shapes.tsx";

/**
 * The per-key "C4" heat ring shown after a round: a ring coloured by speed
 * (confidence) with a coral arc for the key's error share, and a small speed
 * core. Reads on top of the key colours without hiding the letter.
 */
export type HeatRing = {
  readonly codePoint: CodePoint;
  /** Learning confidence / speed in [0, 1] — drives the ring & core colour. */
  readonly confidence: number;
  /** Error share in [0, 1] — the length of the coral arc. */
  readonly errorFrac: number;
};

const R = 15; // ring radius (SVG units; key visual size ≈ 34)
const SW = 4; // ring stroke width
const CIRC = 2 * Math.PI * R;

// Speed → colour: slow coral → mid amber → fast mint.
function speedColor(t: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [255, 145, 102]],
    [0.5, [255, 209, 102]],
    [1, [143, 217, 182]],
  ];
  const v = Math.max(0, Math.min(1, t));
  let c: [number, number, number];
  if (v <= stops[0][0]) c = stops[0][1];
  else if (v >= stops[2][0]) c = stops[2][1];
  else {
    const [lo, hi] = v < stops[1][0] ? [stops[0], stops[1]] : [stops[1], stops[2]];
    const f = (v - lo[0]) / (hi[0] - lo[0]);
    c = lo[1].map((x, i) => Math.round(x + (hi[1][i] - x) * f)) as [
      number,
      number,
      number,
    ];
  }
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export const HeatRingLayer = memo(function HeatRingLayer({
  rings,
}: {
  readonly rings: Iterable<HeatRing>;
}): ReactNode {
  const keyboard = useKeyboard();
  return (
    <Surface>
      {[...rings].map((ring, index) => {
        if (ring.codePoint === 0x0020) {
          return null;
        }
        const combo = keyboard.getCombo(ring.codePoint);
        if (combo == null) {
          return null;
        }
        const shape = keyboard.getShape(combo.id);
        if (shape == null) {
          return null;
        }
        const { x, y } = getKeyCenter(shape);
        const conf = Math.max(0, Math.min(1, ring.confidence));
        const err = Math.max(0, Math.min(1, ring.errorFrac));
        const color = speedColor(conf);
        const coreR = 2.6 + conf * 4;
        const errLen = CIRC * err;
        return (
          <g key={index}>
            {/* speed-coloured base ring */}
            <circle
              className={styles.baseRing}
              cx={x}
              cy={y}
              r={R}
              stroke={color}
              style={{ strokeWidth: SW, opacity: 0.35 + conf * 0.4 }}
            />
            {/* coral error arc (starts at the top, clockwise) */}
            {err > 0.02 && (
              <circle
                className={styles.errorArc}
                cx={x}
                cy={y}
                r={R}
                style={{
                  strokeWidth: SW,
                  strokeDasharray: `${errLen.toFixed(2)} ${CIRC.toFixed(2)}`,
                }}
                transform={`rotate(-90 ${x} ${y})`}
              />
            )}
            {/* speed core (kept small/soft so the letter stays readable) */}
            <circle
              className={styles.core}
              cx={x}
              cy={y}
              r={coreR}
              fill={color}
              style={{ opacity: 0.6 }}
            />
          </g>
        );
      })}
    </Surface>
  );
});
