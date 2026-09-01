import {
  type Keyboard,
  type KeyCombo,
  type KeyShape,
  useKeyboard,
} from "@keylearn/keyboard";
import { Tasks } from "@keylearn/lang";
import { useSettings } from "@keylearn/settings";
import { type CodePoint } from "@keylearn/unicode";
import { clsx } from "clsx";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCapRadius } from "./lighting.ts";
import { cueIsLight } from "./lighting.ts";
import * as styles from "./PointersLayer.module.less";
import { keyGap, keySize, Surface } from "./shapes.tsx";

export const PointersLayer = memo(function PointersLayer({
  suffix,
  delay = 1000,
  helpLevel = 0,
  capsLock = false,
}: {
  readonly suffix: readonly CodePoint[];
  readonly delay?: number;
  /**
   * Whether Caps Lock is on, so the Shift hint can account for it.
   *
   * With it on, a capital needs no Shift and a lower-case letter does — the
   * requirement inverts, but only for letters. Caps Lock does nothing for
   * punctuation, so a brace still wants Shift either way.
   */
  readonly capsLock?: boolean;
  /** Escalating help: 2 = urgent pulse, 3 = finger guide over the key. */
  readonly helpLevel?: number;
}): ReactNode {
  const keyboard = useKeyboard();
  const { settings } = useSettings();
  const radius = useCapRadius(settings);
  // With the board lit, the light IS the cue. Drawing a ring as well would be
  // two markers for one instruction.
  const asLight = cueIsLight(settings);
  const svgRef = useRef<SVGSVGElement>(null);
  const [combo, setCombo] = useState<KeyCombo | null>(null);
  // Only the very next character decides which key is cued. The suffix itself
  // is a fresh array on every keystroke, so depending on it re-ran this — a
  // state change and a new timer — even when the key being pointed at had not
  // moved, as happens on a wrong keystroke.
  const next = suffix.length > 0 ? suffix[0] : null;
  useEffect(() => {
    const tasks = new Tasks();
    setCombo(null);
    if (next != null) {
      const combo = keyboard.getCombo(next);
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
  }, [keyboard, next, delay, helpLevel]);
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
      {...pointers(
        keyboard,
        combo,
        helpLevel,
        capsLock && isLetter(suffix[0]),
        // A whole word in capitals is what Caps Lock is for; one capital is
        // what Shift is for. Suggesting the wrong one teaches a slower habit.
        capsLock !== capsRun(suffix, !capsLock),
        asLight,
        radius,
      )}
      {mainShape != null && guideArrow(mainShape)}
    </Surface>
  );
});

/** Whether Caps Lock has any say over this character. */
function isLetter(codePoint: CodePoint | undefined): boolean {
  return (
    codePoint != null && /\p{Letter}/u.test(String.fromCodePoint(codePoint))
  );
}

function hasCase(codePoint: CodePoint, upper: boolean): boolean {
  const ch = String.fromCodePoint(codePoint);
  return upper ? /\p{Lu}/u.test(ch) : /\p{Ll}/u.test(ch);
}

/**
 * How many characters Caps Lock has to stay held for.
 *
 * Turning it on and off again costs two keystrokes, so for two or three
 * capitals holding Shift is simply faster and this should stay quiet. Four is
 * where the arithmetic turns, and it is also where a run stops being a stray
 * capital and starts being a word — SELECT, INNER JOIN, API_TOKEN.
 */
const CAPS_WORTH_IT = 4;

/**
 * Whether the run ahead is long enough that Caps Lock beats Shift.
 *
 * Reads through the coming characters counting those of the case being asked
 * for, stopping at the first letter of the wrong case. Digits and punctuation
 * neither help nor break the run: CAPS_LOCK_1 is still one word to a typist.
 */
function capsRun(suffix: readonly CodePoint[], upper: boolean): boolean {
  let run = 0;
  for (const codePoint of suffix) {
    if (hasCase(codePoint, upper)) {
      run += 1;
      if (run >= CAPS_WORTH_IT) {
        return true;
      }
    } else if (isLetter(codePoint)) {
      return false;
    }
  }
  return false;
}

function pointers(
  keyboard: Keyboard,
  combo: KeyCombo | null,
  helpLevel = 0,
  capsLockApplies = false,
  suggestCapsLock = false,
  asLight = false,
  /* Passed in rather than looked up: these are plain functions, not
     components, so they cannot ask the board what shape its caps are. */
  radius: (h: number) => number = () => 7,
): ReactNode[] {
  const children = [];
  let main = true;
  while (combo != null) {
    const shape = keyboard.getShape(combo.id);
    if (shape != null) {
      // When the board is lit the cue is drawn by CueGlowLayer, which renders
      // BEFORE the keys so the light comes from under the cap. Nothing to add
      // here beyond the shift/caps hints below.
      if (!asLight) {
        children.unshift(cometPointer(shape, main && helpLevel >= 2, radius));
      }
      main = false;
      if (suggestCapsLock) {
        // The run ahead is long enough to be worth latching. Point at Caps
        // Lock instead of Shift — including when it is already on and the
        // coming word is lower-case, where the advice is to turn it off.
        children.unshift(
          pointer(
            keyboard.getShape("CapsLock"),
            styles.modifierPointer,
            radius,
          ),
        );
      } else if (
        // The same exclusive-or the keycaps use: Caps Lock and Shift each flip
        // the case, so with Caps Lock on a capital needs no Shift and a
        // lower-case letter does.
        capsLockApplies ? !combo.modifier.shift : combo.modifier.shift
      ) {
        const l = keyboard.getShape("ShiftLeft");
        const r = keyboard.getShape("ShiftRight");
        switch (shape.hand) {
          case "left":
            children.unshift(pointer(r, styles.modifierPointer, radius));
            break;
          case "right":
            children.unshift(pointer(l, styles.modifierPointer, radius));
            break;
          default:
            children.unshift(
              pointer(l, styles.modifierPointer, radius),
              pointer(r, styles.modifierPointer, radius),
            );
            break;
        }
      }
      if (combo.modifier.alt) {
        const l = keyboard.getShape("AltLeft");
        const r = keyboard.getShape("AltRight");
        switch (shape.hand) {
          case "left":
            children.unshift(pointer(r, styles.modifierPointer, radius));
            break;
          case "right":
            children.unshift(pointer(l, styles.modifierPointer, radius));
            break;
          default:
            children.unshift(
              pointer(l, styles.modifierPointer, radius),
              pointer(r, styles.modifierPointer, radius),
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
function cometPointer(
  shape: KeyShape | null,
  urgent: boolean,
  radius: (h: number) => number = () => 7,
): ReactNode {
  if (shape == null) {
    return null;
  }
  const x = shape.x * keySize + 1;
  const y = shape.y * keySize + 1;
  const w = shape.w * keySize - keyGap - 2;
  const h = shape.h * keySize - keyGap - 2;
  /* From the board, not a constant. With r = h/2 on a square key the formula
     below collapses to pi*h — the circumference of the circle the cap
     actually is — so the spark still travels at one speed everywhere. */
  const r = radius(h);
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
        style={{ "--dash-shift": `${perimeter * 0.035}px` } as CSSProperties}
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

function pointer(
  shape: KeyShape | null,
  className: string,
  radius: (h: number) => number,
): ReactNode {
  if (shape == null) {
    return null;
  }
  // A ring hugging the keycap (used for modifier hints). Its radius comes
  // from the board, not from a constant: on the round board a cap is a circle
  // or a stadium, and a rounded square around one sits outside it at the ends.
  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;
  const r = radius(h - 2);
  return (
    <rect
      className={className}
      x={x + 1}
      y={y + 1}
      width={w - 2}
      height={h - 2}
      rx={r}
      ry={r}
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
      d={`M ${cx - 2} ${top - 6} h 4 v 5 h 4 ` + `l -6 7 l -6 -7 h 4 z`}
    />
  );
}
