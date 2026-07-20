import { useKeyboard } from "@keybr/keyboard";
import { type CodePoint } from "@keybr/unicode";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import * as styles from "./MasteryLayer.module.less";
import { keyGap, keySize, Surface } from "./shapes.tsx";

export type MasteryKey = {
  readonly codePoint: CodePoint;
  /** Learning confidence in [0, 1]; drives bar width and colour. */
  readonly confidence: number;
};

/**
 * Thin mastery bars under the learned keys, as drawn in the KeyLearn mockup:
 * width grows with confidence and the colour blends from the slow-key colour
 * to the fast-key colour.
 */
export const MasteryLayer = memo(function MasteryLayer({
  keys,
  depressedKeys = [],
}: {
  readonly keys: readonly MasteryKey[];
  readonly depressedKeys?: readonly string[];
}): ReactNode {
  const keyboard = useKeyboard();
  const bars: ReactNode[] = [];
  for (const { codePoint, confidence } of keys) {
    const combo = keyboard.getCombo(codePoint);
    if (combo == null) {
      continue;
    }
    const shape = keyboard.getShape(combo.id);
    if (shape == null) {
      continue;
    }
    const x = shape.x * keySize;
    const y = shape.y * keySize;
    const w = shape.w * keySize - keyGap;
    const h = shape.h * keySize - keyGap;
    const conf = Math.max(0, Math.min(1, confidence));
    const pad = 8;
    const track = w - pad * 2;
    // The bar rides the keycap face, so it drops with it while pressed.
    const pressed = depressedKeys.includes(combo.id);
    bars.push(
      <g
        key={codePoint}
        className={clsx(styles.bar, pressed && styles.pressed)}
      >
        <rect
          x={x + pad}
          y={y + h - 7}
          width={track}
          height={3}
          rx={1.5}
          ry={1.5}
          fill="color-mix(in oklab, var(--KeyboardKey-symbol__color) 18%, transparent)"
        />
        <rect
          x={x + pad}
          y={y + h - 7}
          width={Math.max(3, track * conf)}
          height={3}
          rx={1.5}
          ry={1.5}
          fill={`color-mix(in oklab, var(--fast-key-color) ${Math.round(conf * 100)}%, var(--slow-key-color))`}
        />
      </g>,
    );
  }
  return <Surface>{bars}</Surface>;
});
