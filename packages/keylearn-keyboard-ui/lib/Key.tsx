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
  /**
   * Declared here even though this board ignores them: KeyLayer clones the
   * cued key with these set, and a prop the component does not name falls
   * through the rest-spread onto the <svg> as an unknown DOM attribute —
   * which is exactly what happened, one React warning per keystroke. The
   * KeyLearn board's cue is drawn by PointersLayer, so swallowing them is
   * correct, not an omission.
   */
  readonly cued?: boolean;
  readonly cuedRing?: boolean;
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

/**
 * The visible wall below the face, in board pixels.
 *
 * Five (owner, 4 Sep 2026: taller keys). It was three, which is a low-profile
 * wall — a chiclet. MECH's own lip is 5 units on a 55-unit cap and this board
 * draws 34s, so five PIXELS is proportionally deeper than any of the skinned
 * boards: a cap with somewhere to travel to. That is the point of it, and the
 * press below spends most of it.
 */
const LIP = 5;

/**
 * How far the face travels on a press, as a fraction of the lip.
 *
 * MECH's number. What makes a press read as mechanical rather than as a
 * button going flat is that it does NOT bottom out: a sliver of wall is still
 * showing at the end of the stroke, so the cap has visibly moved DOWN rather
 * than been switched off. This board used to drop the face 3px and take the
 * wall's opacity to zero, which is the flat press it was drawn for.
 */
const TRAVEL = 0.62;

/** How far the face is inset each side, so the body reads as a lip. */
const FACE_IN = 0.6;

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
        // Inset each side so the body shows as a lip the face stands on.
        // ROUND's `faceInX` is 1 unit on a 55-unit cap; this board's caps are
        // 34, so the same lip is 0.6px here.
        x={FACE_IN}
        y={0}
        width={w - FACE_IN * 2}
        height={h}
        rx={9 - FACE_IN}
        ry={9 - FACE_IN}
      />
    ),
  );
  // The moulding, over whatever colour the face ended up.
  children.push(
    shape.shape ? (
      <path className={styles.mould} d={shape.shape} />
    ) : (
      <rect
        className={styles.mould}
        x={FACE_IN}
        y={0}
        width={w - FACE_IN * 2}
        height={h}
        rx={9 - FACE_IN}
        ry={9 - FACE_IN}
      />
    ),
  );
  if (shape.shape == null) {
    // One overhead light, in the same three marks Round Graphite uses: the
    // sheen high and a little left, the bounce off the desk along the inside
    // of the bottom edge, and the hairline along the top. Stroking the whole
    // outline instead would ring the cap in light, which reads as an embossed
    // button rather than a keycap.
    children.push(
      <ellipse
        className={styles.spec}
        cx={w * 0.42}
        cy={h * 0.3}
        rx={w * 0.36}
        ry={h * 0.26}
      />,
    );
    children.push(
      <path className={styles.bounce} d={`M 9 ${h - 0.75} H ${w - 9}`} />,
    );
    children.push(<path className={styles.crest} d={`M 9 0.45 H ${w - 9}`} />);
  }
  if (shape.homing) {
    // The home-row bar, as the round board draws it (owner, 4 Sep 2026):
    // MOULDED, not printed — a shadow with a thin highlight under it, so it
    // reads as a ridge raised out of the cap rather than a dot inked onto it.
    // That is what the two keys actually have, and it is the one mark on the
    // board a learner is meant to find without looking.
    //
    // The round board's numbers, scaled from its 55-unit cap to this 34.
    const k = h / 55;
    const bw = w * 0.3;
    const bx = w / 2 - bw / 2;
    const by = h / 2 + 13 * k;
    children.push(
      <rect
        className={styles.bumpShadow}
        x={bx}
        y={by}
        width={bw}
        height={2 * k}
        rx={k}
      />,
    );
    children.push(
      <rect
        className={styles.bumpLight}
        x={bx}
        y={by + 2 * k}
        width={bw}
        height={k}
        rx={k / 2}
      />,
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
    children.push(
      makeCodePointLabel(
        a,
        lx,
        27,
        clsx(styles.secondarySymbol, styles.baseSymbol, plainOf(a)),
      ),
    );
  }
  if (tb && !ab) {
    children.push(
      makeCodePointLabel(
        b,
        lx,
        12,
        clsx(styles.secondarySymbol, styles.shiftSymbol, plainOf(b)),
      ),
    );
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
  // The same fact the colour carries, written down. A learner who cannot pick
  // the zone colours apart — which is a good part of why the safe palette
  // exists — still has nothing to read if colour is the only channel. One
  // character in the corner of the cap costs the sighted reader nothing and
  // gives that learner the whole answer.
  const fingerMark = fingerMarkOf(shape);
  /**
   * The cap body: full height PLUS the lip, in the wall colour, with the face
   * inset on top of it.
   *
   * This used to be the FACE shape pushed 3px down, with the face put back
   * over it — two copies of one rounded rect, so the cap had no lip at all.
   * Nothing was inset, nothing stepped in, and the only thing separating face
   * from wall was a change of colour. That is the structural difference from
   * the skinned keysets (`SkinnedKey.tsx` says so in as many words), and it is
   * why shading alone never made this board read as moulded: you cannot light
   * a shape that has no moulding in it (owner, 4 Sep 2026, from the Round
   * Graphite study).
   */
  const body = shape.shape ? (
    <path className={styles.side} d={shape.shape} transform="translate(0 3)" />
  ) : (
    <rect
      className={styles.side}
      x={0}
      y={0}
      width={w}
      height={h + LIP}
      rx={9}
      ry={9}
    />
  );
  function KeyComponent({
    depressed,
    toggled,
    showColors,
    cued: _cued,
    cuedRing: _cuedRing,
    ...props
  }: KeyProps): ReactNode {
    const marked = fingerMark != null && !neutralKey;
    return (
      <svg
        {...props}
        className={clsx(
          styles.key,
          // Space and the modifiers. Emitted so the two-tone keysets can give
          // them their own cap colour — a modifier that matches the alphas is
          // the main thing that makes a rendered board look like a diagram.
          neutralKey && styles.neutralKey,
          isDigit(a) && styles.digitKey,
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
        style={{ "--kl-travel": `${(LIP * TRAVEL).toFixed(2)}px` } as never}
      >
        {body}
        <g className={styles.cap}>
          {...children}
          {marked && (
            <text
              className={styles.fingerMark}
              x={w - 6}
              y={h - 5}
              textAnchor="end"
              aria-hidden={true}
            >
              {fingerMark}
            </text>
          )}
        </g>
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

/**
 * A single character naming the finger, in the touch-typing numbering every
 * course already uses: 1 the index, 2 the middle, 3 the ring, 4 the little
 * finger. The thumb is left unmarked — the space bar needs no telling.
 */
function fingerMarkOf({ finger }: KeyShape): string | null {
  switch (finger) {
    case "leftIndex":
    case "rightIndex":
      return "1";
    case "middle":
      return "2";
    case "ring":
      return "3";
    case "pinky":
      return "4";
  }
  return null;
}

/**
 * Letters and numbers are what a learner is practising; the punctuation
 * printed beside them sits back. Returns the class that dims a glyph, or null
 * when it should stay at full strength.
 */
function plainOf(character: unknown): string | null {
  const ch = charOf(character);
  return ch != null && /[A-Za-z0-9]/.test(ch) ? null : styles.specialSymbol;
}

function isDigit(character: unknown): boolean {
  const ch = charOf(character);
  return ch != null && /[0-9]/.test(ch);
}

function charOf(character: unknown): string | null {
  return typeof character === "number" ? String.fromCodePoint(character) : null;
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
