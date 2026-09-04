import {
  KeyCharacters,
  type KeyShape,
  type Language,
} from "@keylearn/keyboard";
import { type MouseProps } from "@keylearn/widget";
import { clsx } from "clsx";
import { type FunctionComponent, memo, type ReactNode } from "react";
import { hiddenKey } from "./hidden.ts";
import { keyGap, keySize } from "./shapes.tsx";
import * as styles from "./SkinnedKey.module.less";
import { MOCK_CAP, type Skin, ZONE_ON_DARK, ZONE_ON_LIGHT } from "./skins.ts";

export type SkinnedKeyProps = {
  readonly depressed?: boolean;
  readonly toggled?: boolean;
  readonly showColors?: boolean;
  readonly cued?: boolean;
  /** Draw the ring: the board is dark, so there is no light to carry the cue. */
  readonly cuedRing?: boolean;
} & MouseProps;

/**
 * Modifier caps whose label sits against the RIGHT edge.
 *
 * How a real board is printed: the keys on the right flank of the alphas —
 * backspace, enter, the right shift — carry their legend on the inside edge,
 * facing the letters. The ones on the left flank carry it on their own left
 * edge. Printing them all flush-left, as this did, leaves "enter" and "back"
 * floating in the middle of a wide cap with a gap where the eye expects the
 * word to end.
 */
const modAlignEnd = new Set(["Backspace", "Enter", "ShiftRight"]);

/**
 * How far a modifier legend sits from its cap's edge, in mock units.
 *
 * On a 55-unit cap this is a little under a quarter of the height, which is
 * roughly what a real keyset leaves. At 9 the word sat hard against the edge
 * and read as overflow rather than as alignment.
 */
const MOD_INSET = 15;

/**
 * The caps-lock lamp.
 *
 * The one thing a real keyboard tells you back, and the three skinned boards
 * said nothing at all — Caps Lock latched, the legends went to capitals, and
 * the cap itself looked exactly as it had a moment before. A MacBook answers
 * this with a single tiny green light in that key and nothing else, which is
 * the whole design: small enough to be furniture when it is off the mind, and
 * the only lit thing on the board when it is not.
 *
 * It sits at the FAR end of the cap rather than beside the legend, which is
 * where a Mac puts it. Our modifier legends are printed hard against their own
 * edge with eight units of margin, and a lamp in that margin would either
 * touch the word or push it — so it takes the empty end instead, where there
 * is nothing to collide with on either board's geometry.
 */
const LAMP = "#5fe39a";

const modLabelText: Record<string, string> = {
  "Tab": "tab",
  "Caps Lock": "caps",
  "Shift": "shift",
  "Enter": "enter",
  "Backspace": "back",
  "Esc": "esc",
};

/**
 * A keycap drawn to the approved mock, not to the KeyLearn board's own recipe.
 *
 * This is a port of the mock's `key()` — the same draw order, the same
 * geometry, the same numbers. It exists as a separate component rather than as
 * CSS overrides on {@link makeKeyComponent} because the two boards disagree at
 * the level of *structure*, not colour: KeyLearn draws a full-size wall offset
 * 3px down and a face on top of it, while these keysets draw a full-height cap
 * body with the face inset inside it and a lip showing along the bottom. Trying
 * to reach the second by restyling the first is what produced a board that was
 * approximately right and never exactly right.
 */
export function makeSkinnedKeyComponent(
  { letterName }: Language,
  shape: KeyShape,
  skin: Skin,
): FunctionComponent<SkinnedKeyProps> {
  const { isCodePoint } = KeyCharacters;
  const { id, a, b } = shape;
  if (hiddenKey.test(id)) {
    const HiddenKey = (): ReactNode => null;
    HiddenKey.displayName = `SkinnedKey[${id}]`;
    return memo(HiddenKey);
  }

  const G = skin.geom;
  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;

  // Space wears the modifier colour, like shift beside it.
  const isMod =
    id === "Space" ||
    shape.labels.some(({ text }) => modLabelText[text] != null);
  const isAccent = skin.accentIds.includes(id) && skin.accentTop != null;

  const modText = shape.labels
    .map(({ text }) => modLabelText[text])
    .find((t) => t != null);

  const blank = (cp: unknown) =>
    cp === 0x0020 || cp === 0x00a0 || cp === 0x202f;
  const prim = isCodePoint(a) && !blank(a) ? letterName(a) : null;
  const shifted =
    isCodePoint(b) &&
    !blank(b) &&
    (!isCodePoint(a) || letterName(a) !== letterName(b))
      ? letterName(b)
      : null;

  const alnum = (t: string | null) => t != null && /[A-Za-z0-9]/.test(t);
  const digitLeads = prim != null && /[0-9]/.test(prim);
  // Digits lead with the number (1! 2@); everything else leads with the shifted
  // symbol ({[ <,), which is how the two are printed on a real keyset.
  const leftText = digitLeads ? prim : shifted;
  const rightText = digitLeads ? shifted : prim;

  const zoneKey = fingerKeyOf(shape);
  const zoneInk =
    zoneKey == null || isMod || isAccent
      ? null
      : (skin.lightCaps ? ZONE_ON_LIGHT : ZONE_ON_DARK)[zoneKey];

  const rowSquash = G.rowSquash[Math.round(shape.y)] ?? G.foreshorten;

  function SkinnedKey({
    depressed,
    toggled,
    showColors,
    cued,
    cuedRing,
    ...props
  }: SkinnedKeyProps): ReactNode {
    // A real switch bottoms out short of flush: the face travels 62% of the
    // lip, so a sliver of wall is still showing at the bottom of the stroke and
    // a little appears above the face, which is what sinking looks like.
    const faceY = depressed === true ? G.lip * G.travel : 0;
    const fx = G.faceInX;
    const fw = w - G.faceInX * 2;

    const topFill = isAccent
      ? `url(#kt-${skin.id})`
      : isMod
        ? `url(#mt-${skin.id})`
        : `url(#at-${skin.id})`;
    const bodyFill = isAccent
      ? `url(#ks-${skin.id})`
      : isMod
        ? `url(#ms-${skin.id})`
        : `url(#as-${skin.id})`;

    const baseInk = isAccent ? skin.accentInk : isMod ? skin.modInk : skin.ink;
    // The next key always wins the colour contest: it wears the cue colour, so
    // the one key you must not miss is never also wearing a finger colour.
    const ink =
      cued === true
        ? skin.cue
        : ((showColors === true ? zoneInk : null) ?? baseInk);

    // Legends sit high on a mechanical cap and centred on a flat one.
    const cy = G.topLegends ? faceY + h * 0.33 : faceY + h / 2;
    // Modifier legends hug an edge, and which edge depends on the flank the
    // cap sits on — see modAlignEnd. The same rule the round board follows.
    const modEndFlat = isMod && modAlignEnd.has(id);
    const lx = isMod ? (modEndFlat ? w - 8 : 8) : w / 2;
    const persp = (ay: number) =>
      `translate(${lx} ${ay}) scale(1 ${rowSquash}) translate(${-lx} ${-ay})`;

    /* ── the round board ───────────────────────────────────────────
       A port of mock 11's `key()`: the same draw order and the same
       numbers, scaled from the mock's 55-unit cap to this board's. It is
       a separate branch rather than a restyling of the one below because
       the two disagree structurally — a round cap has no inset face and
       no foreshortening, and its wall shows as a crescent at the bottom
       rather than a lip across it. */
    if (G.round === true) {
      const k = h / MOCK_CAP; // mock units -> board units
      const rx = h / 2; // circle on 1u, stadium on the rest
      const dy = depressed === true ? (G.travelAbs ?? 4.5) * k : 0;
      const lip = G.lip * k;
      const modEnd = modAlignEnd.has(id);
      const cxc = w / 2;
      const cyc = h / 2;

      return (
        <svg
          {...props}
          className={styles.key}
          x={x}
          y={y}
          width={w}
          height={h}
          overflow="visible"
          data-key={id}
        >
          {/* Two shadows, not one. A single offset blur reads as a sticker;
              a real object has a tight dark contact beneath it AND a wide
              soft ambient around it. They stay put while the cap travels,
              which is what tells the eye the key went down rather than the
              whole key moving. */}
          <rect
            x={-k}
            y={(G.shWideDy ?? 4) * k}
            width={w + 2 * k}
            height={h + lip}
            rx={rx}
            fill="#000000"
            opacity={(G.shWideOp ?? 0.3) * (depressed === true ? 0.55 : 1)}
            filter={`url(#shw-${skin.id})`}
          />
          <rect
            x={0}
            y={(G.shTightDy ?? 2) * k}
            width={w}
            height={h + lip}
            rx={rx}
            fill="#000000"
            opacity={(G.shTightOp ?? 0.45) * (depressed === true ? 0.55 : 1)}
            filter={`url(#sht-${skin.id})`}
          />
          <g transform={dy === 0 ? undefined : `translate(0 ${dy.toFixed(2)})`}>
            <rect
              x={0}
              y={0}
              width={w}
              height={h + lip}
              rx={rx}
              fill={bodyFill}
            />
            <rect
              x={k}
              y={0}
              width={w - 2 * k}
              height={h}
              rx={rx - k}
              fill={topFill}
            />
            <rect
              x={k}
              y={0}
              width={w - 2 * k}
              height={h}
              rx={rx - k}
              fill={`url(#dish-${skin.id})`}
            />
            {/* One soft light overhead: the sheen sits high and a little
                left of centre rather than filling the whole face. */}
            <ellipse
              cx={w * (G.specCx ?? 0.42)}
              cy={h * (G.specCy ?? 0.3)}
              rx={w * (G.specRx ?? 0.36)}
              ry={h * (G.specRy ?? 0.26)}
              fill={`url(#spec-${skin.id})`}
              opacity={G.specOp ?? 0.34}
            />
            {/* Bounce off the desk along the bottom edge, and the hairline
                along the top. Stroking the whole outline rings the cap in
                light, which reads as an embossed button, not a keycap. */}
            <path
              d={`M ${rx} ${h - 1.2 * k} H ${w - rx}`}
              stroke="#ffffff"
              strokeOpacity={G.bounceOp ?? 0.08}
              strokeWidth={1}
              fill="none"
            />
            <path
              d={`M ${rx} ${0.7 * k} H ${w - rx}`}
              stroke="#ffffff"
              strokeOpacity={0.17}
              strokeWidth={1.1}
              fill="none"
            />
            {modText != null ? (
              <text
                className={clsx(styles.legend, cued === true && styles.cueInk)}
                // Against an edge, not centred — how a real board is printed.
                // Backspace, enter and the right shift carry their legend on
                // the inside edge facing the letters; tab, caps and the left
                // shift carry it on their own left edge. See modAlignEnd.
                // Centred, the word floats in the middle of a wide cap with
                // nothing to anchor it to.
                x={modEnd ? w - MOD_INSET * k : MOD_INSET * k}
                y={cyc + 4 * k}
                textAnchor={modEnd ? "end" : "start"}
                style={{ fill: ink }}
                fontSize={(G.legWord ?? 12) * k}
                fontWeight={skin.weight}
                letterSpacing=".03em"
              >
                {modText}
              </text>
            ) : shifted != null ? (
              <>
                <text
                  className={clsx(
                    styles.legend,
                    cued === true && styles.cueInk,
                  )}
                  x={cxc}
                  y={cyc - (G.legPairUp ?? 3) * k}
                  textAnchor="middle"
                  style={{ fill: ink }}
                  fontSize={(G.legPair ?? 13) * k}
                  fontWeight={skin.weight}
                  letterSpacing=".01em"
                >
                  {digitLeads ? shifted : shifted}
                </text>
                <text
                  className={clsx(
                    styles.legend,
                    cued === true && styles.cueInk,
                  )}
                  x={cxc}
                  y={cyc + (G.legPairDown ?? 13) * k}
                  textAnchor="middle"
                  style={{ fill: ink }}
                  fontSize={(G.legPair ?? 13) * k}
                  fontWeight={skin.weight}
                  letterSpacing=".01em"
                >
                  {prim}
                </text>
              </>
            ) : prim != null ? (
              <text
                className={clsx(styles.legend, cued === true && styles.cueInk)}
                x={cxc}
                y={cyc + 6 * k}
                textAnchor="middle"
                style={{ fill: ink }}
                fontSize={(G.legSingle ?? 17) * k}
                fontWeight={skin.weight}
                letterSpacing=".03em"
              >
                {prim}
              </text>
            ) : null}
            {/* Moulded, not printed: a shadow with a highlight under it. On a
                board that teaches touch typing these are where the hands
                start every lesson. */}
            {shape.homing && (
              <>
                <rect
                  x={cxc - (w * (G.homingW ?? 0.3)) / 2}
                  y={cyc + (G.homingDy ?? 13) * k}
                  width={w * (G.homingW ?? 0.3)}
                  height={2 * k}
                  rx={k}
                  fill="#000000"
                  opacity={0.34}
                />
                <rect
                  x={cxc - (w * (G.homingW ?? 0.3)) / 2}
                  y={cyc + ((G.homingDy ?? 13) + 2) * k}
                  width={w * (G.homingW ?? 0.3)}
                  height={k}
                  rx={k / 2}
                  fill="#ffffff"
                  opacity={0.1}
                />
              </>
            )}
          </g>
          {id === "CapsLock" && toggled === true && (
            <>
              <circle
                cx={w - h * 0.26}
                cy={h / 2 + dy}
                r={h * 0.16}
                fill={LAMP}
                opacity={0.22}
              />
              <circle
                cx={w - h * 0.26}
                cy={h / 2 + dy}
                r={h * 0.07}
                fill={LAMP}
              />
            </>
          )}
          {/* Only when the board is dark. With the light on, the light IS the
              cue and a ring as well would be two markers for one instruction. */}
          {cuedRing === true && (
            <rect
              x={-1.5 * k}
              y={-1.5 * k}
              width={w + 3 * k}
              height={h + 3 * k}
              rx={rx + 1.5 * k}
              fill="none"
              stroke={skin.cue}
              strokeWidth={2.4 * k}
            />
          )}
        </svg>
      );
    }

    return (
      <svg
        {...props}
        className={styles.key}
        x={x}
        y={y}
        width={w}
        height={h}
        overflow="visible"
        data-key={id}
      >
        <rect
          x={0}
          y={G.shDy}
          width={w}
          height={h + G.lip}
          rx={G.rxBase}
          fill="#000000"
          opacity={depressed === true ? G.shOp * 0.4 : G.shOp}
        />
        {/* The wall runs the FULL height of the cap with the face inset inside
            it, so it shows as a hairline down each side and a lip along the
            bottom. Starting it below the face leaves the top of every cap with
            nothing behind it, which reads as detached. */}
        <rect
          x={0}
          y={0}
          width={w}
          height={h + G.lip}
          rx={G.rxBase}
          fill={bodyFill}
        />
        <rect
          x={fx}
          y={faceY}
          width={fw}
          height={h}
          rx={G.rxFace}
          fill={topFill}
        />
        {G.dish && (
          <rect
            x={fx}
            y={faceY}
            width={fw}
            height={h}
            rx={G.rxFace}
            fill={`url(#dish-${skin.id})`}
          />
        )}
        {!skin.matte && (
          <rect
            x={fx}
            y={faceY}
            width={fw}
            height={h * 0.32}
            rx={G.rxFace}
            fill={`url(#gl-${skin.id})`}
          />
        )}
        {/* A hairline along the top edge only. Stroking the whole face outline
            rings the cap in light, which is what makes it read as an embossed
            button rather than as a keycap with depth. */}
        <path
          d={`M ${fx + G.rxFace} ${faceY + 0.5} H ${fx + fw - G.rxFace}`}
          stroke="#ffffff"
          strokeOpacity={skin.lightCaps ? 0.5 : 0.09}
          strokeWidth={1}
          fill="none"
        />
        {/* Only when the board is dark. With the backlight on, the light IS
            the cue and a ring as well would be two markers for one
            instruction. */}
        {cuedRing === true && (
          <rect
            x={fx - 1}
            y={faceY - 1}
            width={fw + 2}
            height={h + 2}
            rx={G.rxFace + 1}
            fill="none"
            stroke={skin.cue}
            strokeWidth={2}
          />
        )}
        {modText != null ? (
          <text
            className={clsx(styles.legend, cued === true && styles.cueInk)}
            x={lx}
            y={cy}
            transform={persp(cy)}
            textAnchor={modEndFlat ? "end" : "start"}
            dominantBaseline="central"
            style={{ fill: ink }}
            fontSize={skin.size - 2.5}
            fontWeight={skin.weight}
            letterSpacing=".02em"
          >
            {modText}
          </text>
        ) : shifted != null && G.topLegends ? (
          <>
            <text
              className={clsx(styles.legend, cued === true && styles.cueInk)}
              x={lx - 1.7}
              y={cy}
              transform={persp(cy)}
              textAnchor="end"
              dominantBaseline="central"
              style={{ fill: ink }}
              fillOpacity={alnum(leftText) ? 1 : 0.55}
              fontSize={skin.size - 1.5}
              fontWeight={skin.weight}
            >
              {leftText}
            </text>
            <text
              className={clsx(styles.legend, cued === true && styles.cueInk)}
              x={lx + 1.7}
              y={cy}
              transform={persp(cy)}
              textAnchor="start"
              dominantBaseline="central"
              style={{ fill: ink }}
              fillOpacity={alnum(rightText) ? 1 : 0.55}
              fontSize={skin.size - 1.5}
              fontWeight={skin.weight}
            >
              {rightText}
            </text>
          </>
        ) : shifted != null ? (
          <>
            <text
              className={clsx(styles.legend, cued === true && styles.cueInk)}
              x={lx}
              y={cy - 5.9}
              transform={persp(cy - 5.9)}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: ink }}
              fillOpacity={0.66}
              fontSize={skin.size - 3}
              fontWeight={skin.weight}
            >
              {shifted}
            </text>
            <text
              className={clsx(styles.legend, cued === true && styles.cueInk)}
              x={lx}
              y={cy + 4.9}
              transform={persp(cy + 4.9)}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: ink }}
              fontSize={skin.size}
              fontWeight={skin.weight}
            >
              {prim}
            </text>
          </>
        ) : prim != null ? (
          <text
            className={clsx(styles.legend, cued === true && styles.cueInk)}
            x={lx}
            y={cy}
            transform={persp(cy)}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: ink }}
            fillOpacity={alnum(prim) ? 1 : 0.55}
            fontSize={skin.size}
            fontWeight={skin.weight}
          >
            {prim}
          </text>
        ) : null}
        {shape.homing && (
          <rect
            x={w / 2 - 5}
            y={faceY + h - 6}
            width={10}
            height={1.6}
            rx={0.8}
            style={{ fill: ink }}
            fillOpacity={0.6}
          />
        )}
        {id === "CapsLock" && toggled === true && (
          <>
            <circle cx={w - 9} cy={cy} r={5.5} fill={LAMP} opacity={0.22} />
            <circle cx={w - 9} cy={cy} r={2.4} fill={LAMP} />
          </>
        )}
      </svg>
    );
  }

  SkinnedKey.displayName = `SkinnedKey[${id}]`;
  return memo(SkinnedKey);
}

// The shape already names the zone the way the palette does — leftIndex and
// rightIndex rather than a hand plus "index" — so there is nothing to map.
function fingerKeyOf({ finger }: KeyShape): string | null {
  return finger ?? null;
}
