import {
  type Keyboard,
  type KeyCombo,
  type KeyShape,
  useKeyboard,
} from "@keybr/keyboard";
import { Tasks } from "@keybr/lang";
import { type CodePoint } from "@keybr/unicode";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
      children.unshift(cometPointer(shape, main && helpLevel >= 2));
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

/**
 * The comet cue: a spark of light travelling around the keycap's border on a
 * faint rail, with a fading trail behind it. Three rects share one rounded
 * geometry; the dash pattern and an animated dash offset make the light move.
 */
function cometPointer(shape: KeyShape | null, urgent: boolean): ReactNode {
  if (shape == null) {
    return null;
  }
  const x = shape.x * keySize + 1;
  const y = shape.y * keySize + 1;
  const w = shape.w * keySize - keyGap - 2;
  const h = shape.h * keySize - keyGap - 2;
  const r = 7;
  // Rounded-rect perimeter: the straight stretches plus the corner arcs.
  const perimeter = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  const rect = { x, y, width: w, height: h, rx: r, ry: r };
  // One lap takes longer on bigger keys, so the spark travels at the same
  // speed everywhere (a standard key's ~132px perimeter maps to 1.8s).
  const duration = perimeter / 73;
  return (
    <g
      className={urgent ? `${styles.comet} ${styles.urgent}` : styles.comet}
      style={
        {
          "--comet-perimeter": perimeter,
          "--comet-duration": `${duration.toFixed(2)}s`,
        } as CSSProperties
      }
    >
      <rect className={styles.rail} {...rect} />
      {/* The tail: stacked dashes whose LEADING edges all align at the head
          (each layer's dash offset is shifted by its own length), fading in
          opacity the further they trail behind — a smooth gradient comet
          rather than a hard-edged snake. */}
      {[
        [0.32, 0.08],
        [0.27, 0.16],
        [0.22, 0.26],
        [0.17, 0.4],
        [0.12, 0.58],
        [0.07, 0.8],
      ].map(([frac, opacity], i) => {
        const len = perimeter * frac;
        return (
          <rect
            key={i}
            className={styles.tail}
            {...rect}
            strokeDasharray={`${len} ${perimeter - len}`}
            strokeOpacity={opacity}
            style={{ "--dash-shift": `${len}px` } as CSSProperties}
          />
        );
      })}
      <rect
        className={styles.spark}
        {...rect}
        strokeDasharray={`${perimeter * 0.035} ${perimeter * 0.965}`}
        style={
          { "--dash-shift": `${perimeter * 0.035}px` } as CSSProperties
        }
      />
      <animate
        attributeName="opacity"
        from={0}
        to={1}
        dur="0.3s"
        repeatCount="1"
        restart="always"
      />
    </g>
  );
}

function pointer(shape: KeyShape | null, className: string): ReactNode {
  if (shape == null) {
    return null;
  }
  // A rounded ring hugging the keycap (used for modifier hints).
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
