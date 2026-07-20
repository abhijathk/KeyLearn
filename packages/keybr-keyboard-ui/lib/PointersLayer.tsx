import {
  type Keyboard,
  type KeyCombo,
  type KeyShape,
  useKeyboard,
} from "@keybr/keyboard";
import { Tasks } from "@keybr/lang";
import { type CodePoint } from "@keybr/unicode";
import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./PointersLayer.module.less";
import { keyGap, keySize, Surface } from "./shapes.tsx";

export const PointersLayer = memo(function PointersLayer({
  suffix,
  delay = 1000,
  helpLevel = 0,
}: {
  readonly suffix: readonly CodePoint[];
  readonly delay?: number;
  /** Escalating help: 2 = urgent pulse, 3 = finger guide over the key. */
  readonly helpLevel?: number;
}): ReactNode {
  const keyboard = useKeyboard();
  const svgRef = useRef<SVGSVGElement>(null);
  const [combo, setCombo] = useState<KeyCombo | null>(null);
  useEffect(() => {
    const tasks = new Tasks();
    setCombo(null);
    if (suffix.length > 0) {
      const combo = keyboard.getCombo(suffix[0]);
      if (combo != null) {
        // Escalated help cannot wait — cue the key immediately.
        tasks.delayed(helpLevel >= 2 ? 0 : delay, () => {
          setCombo(combo);
        });
      }
    }
    return () => {
      tasks.cancelAll();
    };
  }, [keyboard, suffix, delay, helpLevel]);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg != null) {
      for (const animate of svg.querySelectorAll("animate")) {
        animate.beginElement();
      }
    }
  }, [combo]);
  const mainShape =
    combo != null && helpLevel >= 3 ? keyboard.getShape(combo.id) : null;
  return (
    <Surface ref={svgRef}>
      {...pointers(keyboard, combo, helpLevel)}
      {mainShape != null && guideArrow(mainShape)}
    </Surface>
  );
});

function pointers(
  keyboard: Keyboard,
  combo: KeyCombo | null,
  helpLevel = 0,
): ReactNode[] {
  const children = [];
  let main = true;
  while (combo != null) {
    const shape = keyboard.getShape(combo.id);
    if (shape != null) {
      children.unshift(
        pointer(
          shape,
          main && helpLevel >= 2
            ? `${styles.pointer} ${styles.urgent}`
            : styles.pointer,
        ),
      );
      main = false;
      if (combo.modifier.shift) {
        const l = keyboard.getShape("ShiftLeft");
        const r = keyboard.getShape("ShiftRight");
        switch (shape.hand) {
          case "left":
            children.unshift(pointer(r, styles.modifierPointer));
            break;
          case "right":
            children.unshift(pointer(l, styles.modifierPointer));
            break;
          default:
            children.unshift(
              pointer(l, styles.modifierPointer),
              pointer(r, styles.modifierPointer),
            );
            break;
        }
      }
      if (combo.modifier.alt) {
        const l = keyboard.getShape("AltLeft");
        const r = keyboard.getShape("AltRight");
        switch (shape.hand) {
          case "left":
            children.unshift(pointer(r, styles.modifierPointer));
            break;
          case "right":
            children.unshift(pointer(l, styles.modifierPointer));
            break;
          default:
            children.unshift(
              pointer(l, styles.modifierPointer),
              pointer(r, styles.modifierPointer),
            );
            break;
        }
      }
    }
    combo = combo.prefix;
  }
  return children;
}

function pointer(shape: KeyShape | null, className: string): ReactNode {
  if (shape == null) {
    return null;
  }
  // A rounded ring hugging the keycap, like the mockup's glowing next key.
  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;
  return (
    <rect
      className={className}
      x={x + 1}
      y={y + 1}
      width={w - 2}
      height={h - 2}
      rx={7}
      ry={7}
    >
      <animate
        attributeName="opacity"
        from={0}
        to={1}
        dur="0.3s"
        repeatCount="1"
        restart="always"
      />
    </rect>
  );
}

function guideArrow(shape: KeyShape): ReactNode {
  const cx = shape.x * keySize + (shape.w * keySize - keyGap) / 2;
  const top = Math.max(8, shape.y * keySize - 10);
  return (
    <path
      className={styles.guide}
      d={
        `M ${cx - 2} ${top - 6} h 4 v 5 h 4 ` +
        `l -6 7 l -6 -7 h 4 z`
      }
    />
  );
}
