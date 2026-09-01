import { useKeyboard } from "@keylearn/keyboard";
import { useSettings } from "@keylearn/settings";
import { type CodePoint } from "@keylearn/unicode";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import { useCapRadius } from "./lighting.ts";
import { keyGap, keySize, Surface } from "./shapes.tsx";
import * as styles from "./WrongKeyLayer.module.less";

/**
 * A one-shot warm flash on the key the user actually pressed when it was the
 * wrong one — the mistake is taught where it happened, then it's gone.
 */
export const WrongKeyLayer = memo(function WrongKeyLayer({
  codePoint,
  depressedKeys = [],
}: {
  readonly codePoint: CodePoint;
  readonly depressedKeys?: readonly string[];
}): ReactNode {
  const keyboard = useKeyboard();
  const { settings } = useSettings();
  const radius = useCapRadius(settings);
  const combo = keyboard.getCombo(codePoint);
  if (combo == null) {
    return null;
  }
  const shape = keyboard.getShape(combo.id);
  if (shape == null) {
    return null;
  }
  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;
  const r = radius(h - 2);
  // The flash rides the keycap face, dropping with it while held down.
  const pressed = depressedKeys.includes(combo.id);
  return (
    <Surface>
      <rect
        className={clsx(styles.flash, pressed && styles.pressed)}
        x={x + 1}
        y={y + 1}
        width={w - 2}
        height={h - 2}
        rx={r}
        ry={r}
      />
    </Surface>
  );
});
