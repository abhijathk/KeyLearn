import {
  type DeadCharacter,
  KeyCharacters,
  type KeyShape,
  type LabelShape,
  type Language,
  type LigatureCharacter,
} from "@keylearn/keyboard";
import { type CodePoint, isDiacritic } from "@keylearn/unicode";
import { type ClassName, type MouseProps } from "@keylearn/widget";
import { clsx } from "clsx";
import { type FunctionComponent, memo, type ReactNode } from "react";
import * as styles from "./Key.module.less";
import { keyGap, keySize } from "./shapes.tsx";

export type KeyProps = {
  readonly depressed?: boolean;
  readonly toggled?: boolean;
  readonly showColors?: boolean;
} & MouseProps;

// Keys the KeyLearn board hides entirely: the mockup shows a floating space
// bar with no Ctrl/Alt/Meta clutter around it.
const hiddenKey =
  /^(ControlLeft|ControlRight|AltLeft|AltRight|MetaLeft|MetaRight|OSLeft|OSRight|ContextMenu|Fn|FnLock|Lang[0-9]|Convert|NonConvert|KanaMode|IntlYen|IntlRo)$/;

// Quiet lowercase labels for the modifier keys, as drawn in the mockup.
const modLabelText: Record<string, string> = {
  "Tab": "tab",
  "Caps Lock": "caps",
  "Shift": "shift",
  "Enter": "enter",
  "Backspace": "back",
  "Esc": "esc",
};

export function makeKeyComponent(
  { letterName }: Language,
  shape: KeyShape,
): FunctionComponent<KeyProps> {
  const { isCodePoint, isDead, isLigature } = KeyCharacters;
  const { id, a, b, c, d } = shape;
  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;
  if (hiddenKey.test(id)) {
    const HiddenKey = (): ReactNode => null;
    HiddenKey.displayName = `Key[${id}]`;
    return memo(HiddenKey);
  }
  // Modifier keys and the space bar stay in the plain cap colour even when
  // finger zones are on — only the typing keys wear their zone tint (as in
  // the redesign mockup, where tab/caps/shift/enter/back/space are neutral).
  const neutralKey =
    id === "Space" ||
    shape.labels.some(({ text }) => modLabelText[text] != null);
  const children: ReactNode[] = [];
  children.push(
    shape.shape ? (
      <path className={styles.button} d={shape.shape} />
    ) : (
      <rect
        className={styles.button}
        x={0}
        y={0}
        width={w}
        height={h}
        rx={9}
        ry={9}
      />
    ),
  );
  if (shape.homing) {
    children.push(
      <circle className={styles.bump} cx={w / 2} cy={h - 5} r={3} />,
    );
  }
  for (const label of shape.labels) {
    const text = modLabelText[label.text] ?? label.text;
    if (text) {
      children.push(
        makeLabel(
          { text, pos: [w / 2, h / 2 + 1], align: ["m", "m"] },
          styles.modSymbol,
        ),
      );
    }
  }
  const ta = isCodePoint(a);
  const tb = isCodePoint(b);
  const tc = isCodePoint(c);
  const td = isCodePoint(d);
  const ab = ta && tb && letterName(a) === letterName(b);
  const cd = tc && td && letterName(c) === letterName(d);
  // Keys with an AltGr layer (c/d) keep two columns (left a/b, right c/d);
  // ordinary number / punctuation keys with only a base+shift pair are centred
  // horizontally instead of hugging the left edge.
  const hasAlt =
    tc || td || isDead(c) || isDead(d) || isLigature(c) || isLigature(d);
  const lx = hasAlt ? 10 : w / 2;
  // Letters get one centred glyph; keys whose shift layer differs (numbers,
  // punctuation) show both symbols stacked, like the original keyboard.
  if (ta && !ab) {
    children.push(makeCodePointLabel(a, lx, 27, styles.secondarySymbol));
  }
  if (tb && !ab) {
    children.push(makeCodePointLabel(b, lx, 12, styles.secondarySymbol));
  }
  if (tc && !cd) {
    children.push(makeCodePointLabel(c, 25, 27, styles.secondarySymbol));
  }
  if (td && !cd) {
    children.push(makeCodePointLabel(d, 25, 12, styles.secondarySymbol));
  }
  if (ta && ab) {
    children.push(
      makeCodePointLabel(a, w / 2, h / 2 + 1, styles.primarySymbol),
    );
  }
  if (tc && cd) {
    children.push(makeCodePointLabel(c, 25, 27, styles.primarySymbol));
  }
  if (isDead(a)) {
    children.push(makeDeadLabel(a, lx, 27, styles.secondarySymbol));
  }
  if (isDead(b)) {
    children.push(makeDeadLabel(b, lx, 12, styles.secondarySymbol));
  }
  if (isDead(c)) {
    children.push(makeDeadLabel(c, 25, 27, styles.secondarySymbol));
  }
  if (isDead(d)) {
    children.push(makeDeadLabel(d, 25, 12, styles.secondarySymbol));
  }
  if (isLigature(a)) {
    children.push(makeLigatureLabel(a, lx, 27, styles.secondarySymbol));
  }
  if (isLigature(b)) {
    children.push(makeLigatureLabel(b, lx, 12, styles.secondarySymbol));
  }
  if (isLigature(c)) {
    children.push(makeLigatureLabel(c, 25, 27, styles.secondarySymbol));
  }
  if (isLigature(d)) {
    children.push(makeLigatureLabel(d, 25, 12, styles.secondarySymbol));
  }
  const zoneClassName = zoneClassNameOf(shape);
  // The solid darker side of the keycap; the face drops onto it when pressed.
  const side = shape.shape ? (
    <path className={styles.side} d={shape.shape} transform="translate(0 3)" />
  ) : (
    <rect
      className={styles.side}
      x={0}
      y={3}
      width={w}
      height={h}
      rx={9}
      ry={9}
    />
  );
  function KeyComponent({
    depressed,
    toggled,
    showColors,
    ...props
  }: KeyProps): ReactNode {
    return (
      <svg
        {...props}
        className={clsx(
          styles.key,
          depressed && styles.depressedKey,
          toggled && styles.toggledKey,
          showColors && !neutralKey && zoneClassName,
        )}
        x={x}
        y={y}
        width={w}
        height={h}
        overflow="visible"
        data-key={id}
      >
        {side}
        <g className={styles.cap}>{...children}</g>
      </svg>
    );
  }
  KeyComponent.displayName = `Key[${id}]`;
  return memo(KeyComponent);

  function makeCodePointLabel(
    codePoint: CodePoint,
    x: number,
    y: number,
    className: ClassName,
  ): ReactNode {
    switch (codePoint) {
      case /* SPACE */ 0x0020:
      case /* NO-BREAK SPACE */ 0x00a0:
      case /* NARROW NO-BREAK SPACE */ 0x202f:
        return null;
    }
    return makeLabel(
      {
        text: letterName(codePoint),
        pos: [x, y],
        align: ["m", "m"],
      },
      className,
    );
  }

  function makeDeadLabel(
    { dead }: DeadCharacter,
    x: number,
    y: number,
    className: ClassName,
  ): ReactNode {
    return makeLabel(
      {
        text: isDiacritic(dead)
          ? String.fromCodePoint(/* DOTTED CIRCLE */ 0x25cc, dead)
          : String.fromCodePoint(dead),
        pos: [x, y],
        align: ["m", "m"],
      },
      clsx(className, styles.deadSymbol),
    );
  }

  function makeLigatureLabel(
    { ligature }: LigatureCharacter,
    x: number,
    y: number,
    className: ClassName,
  ): ReactNode {
    return makeLabel(
      {
        text: ligature,
        pos: [x, y],
        align: ["m", "m"],
      },
      clsx(className, styles.ligatureSymbol),
    );
  }
}

function makeLabel(label: LabelShape, className: ClassName = null): ReactNode {
  const { text, pos = [10, 20], align = ["s", "m"] } = label;
  const [x, y] = pos;
  const [ha, va] = align;
  let textAnchor: "start" | "middle" | "end";
  switch (ha) {
    case "s":
      textAnchor = "start";
      break;
    case "m":
      textAnchor = "middle";
      break;
    case "e":
      textAnchor = "end";
      break;
  }
  let dominantBaseline: "text-after-edge" | "middle" | "text-before-edge";
  switch (va) {
    case "b":
      dominantBaseline = "text-after-edge";
      break;
    case "m":
      dominantBaseline = "middle";
      break;
    case "t":
      dominantBaseline = "text-before-edge";
      break;
  }
  return (
    <text
      className={clsx(styles.symbol, className)}
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      direction="ltr"
    >
      {text}
    </text>
  );
}

function zoneClassNameOf(shape: KeyShape): string | null {
  return clsx(handClassNameOf(shape), fingerClassNameOf(shape));
}

function handClassNameOf({ hand }: KeyShape): string | null {
  switch (hand) {
    case "left":
      return styles.handLeft;
    case "right":
      return styles.handRight;
  }
  return null;
}

function fingerClassNameOf({ finger }: KeyShape): string | null {
  switch (finger) {
    case "pinky":
      return styles.fingerPinky;
    case "ring":
      return styles.fingerRing;
    case "middle":
      return styles.fingerMiddle;
    case "leftIndex":
      return styles.fingerLeftIndex;
    case "rightIndex":
      return styles.fingerRightIndex;
    case "thumb":
      return styles.fingerThumb;
    default:
      return null;
  }
}
