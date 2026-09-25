import { clsx } from "clsx";
import { Fragment, type ReactNode, useId, useMemo } from "react";
import * as styles from "./kids.module.less";

/**
 * ONE CARD, USED BY ALL OF THEM.
 *
 * Time Keepers' overlays were six unrelated objects — a rounded white panel
 * here, a badge and a ribbon there — none of which belonged to a road in 1960s
 * Kerala, and all of which a child had to read differently. This is the one
 * object they now share: the scoreboard's torn paper, an eyebrow saying which
 * kind of card it is, and the keys that dismiss it drawn as the keys they are.
 *
 * It is deliberately Time Keepers only. Dino Run and the Hero Trail keep their
 * own cards, because the three worlds are meant to share nothing but the
 * learner.
 */
export function RoadCard({
  kind,
  eyebrow,
  title,
  letter,
  finger,
  keys,
  wide = false,
  onDismiss,
  children,
}: {
  /** Only used to seed the tear, so a card type does not re-tear as it updates. */
  readonly kind: string;
  readonly eyebrow: string;
  readonly title?: ReactNode;
  /** The new letter, when this is the unlock card. */
  readonly letter?: string;
  readonly finger?: string | null;
  readonly keys: readonly KeyHint[];
  /**
   * For the cards a child READS rather than waves away — the story, the
   * sticker album: the same sheet, torn wider, and the text set as prose.
   */
  readonly wide?: boolean;
  /**
   * The cards a child opened themselves, with a click, close the way they
   * opened: a click on the dimmed road around them. The road's own cards
   * arrive unasked and do not, so a stray click cannot skip one.
   */
  readonly onDismiss?: () => void;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <div
      className={styles.roadScrim}
      role="alertdialog"
      aria-modal={true}
      onClick={onDismiss}
    >
      <div
        className={clsx(styles.roadCard, wide && styles.roadCardWide)}
        onClick={onDismiss == null ? undefined : (ev) => ev.stopPropagation()}
      >
        <Tear seed={kind} />
        <div className={styles.roadBody}>
          <p className={styles.roadEyebrow}>{eyebrow}</p>
          {letter != null && (
            <p className={styles.roadLetter} aria-hidden={true}>
              {letter.toUpperCase()}
            </p>
          )}
          {finger != null && <p className={styles.roadFinger}>{finger}</p>}
          {title != null && <h3 className={styles.roadTitle}>{title}</h3>}
          {children}
          <KeyRow keys={keys} />
        </div>
      </div>
    </div>
  );
}

/**
 * A FRESH TEAR EACH TIME THE CARD OPENS.
 *
 * The notice board tears itself with three filters defined once in a global
 * `<defs>`, which is right for a thing that is always on screen. A card is a
 * thing you see six times an evening, and one fixed rip used by all of them is
 * a shape the eye learns in an afternoon — so the seed is drawn when the card
 * mounts, and no two cards are ever torn alike. It costs nothing: the filter
 * is rasterised once either way.
 *
 * The three scales are ONE tear at three depths — the rim pushed furthest,
 * then the fibre, then the printed face — so the fringe is widest where the
 * sheet was ripped. The edge is never drawn as a path: a hand-written polygon
 * has evenly spaced points and so gives evenly spaced teeth, which reads as a
 * decoration rather than a tear.
 */
function Tear({ seed }: { readonly seed: string }): ReactNode {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // `kind` is in the dep list so that a card which re-renders — the unlock
  // card does, on every press of the new letter — keeps the sheet it opened
  // with instead of tearing itself again under the child's eyes.
  const n = useMemo(() => Math.floor(Math.random() * 9999), [seed]);
  const id = (part: string) => `klvCard${uid}${part}`;
  return (
    <span className={styles.roadSheet} aria-hidden={true}>
      <svg
        width="0"
        height="0"
        focusable="false"
        style={{ position: "absolute" }}
      >
        <defs>
          {(
            [
              ["Rim", 14],
              ["Fibre", 11],
              ["Face", 7],
            ] as const
          ).map(([part, scale]) => (
            <filter
              key={part}
              id={id(part)}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.014 0.09"
                numOctaves="4"
                seed={n}
                result="n"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="n"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          ))}
        </defs>
      </svg>
      <span
        className={styles.roadRim}
        style={{ filter: `url(#${id("Rim")}) blur(0.4px)` }}
      />
      <span
        className={styles.roadFibre}
        style={{ filter: `url(#${id("Fibre")}) blur(0.35px)` }}
      />
      <span
        className={styles.roadFace}
        style={{ filter: `url(#${id("Face")})` }}
      />
    </span>
  );
}

/** One cap on the card's footer, and what pressing it does. */
export type KeyHint = {
  /** The legend, as the board prints it: "space", "enter", or a letter. */
  readonly cap: string;
  readonly what: string;
  /**
   * Which finger's colour the cap wears. A letter passes its own zone from
   * `ZONE_OF`, so the cap on the card is the colour of the cap on the board.
   */
  readonly zone: string;
  readonly wide?: boolean;
  /**
   * What the cap does when it is clicked or tapped. Given, the cap is a real
   * button: the cards opened by a click must close by one too, and a child on
   * a tablet has no Enter key to press.
   */
  readonly onPress?: () => void;
};

/**
 * THE CAPS ARE THE KEYBOARD'S, NOT PICTURES OF A KEYBOARD.
 *
 * Same 3.5px bottom edge and 2.5px inset ring as `.key` below the road, built
 * from the same `--key-bg` and `--kz`, so they reskin with the theme and with
 * night exactly as the board does.
 *
 * They DO carry a finger colour, which the board's own Enter and space bar
 * deliberately do not -- down there the frame keys are left neutral so they do
 * not compete with the letter a learner is being pointed at, but here they are
 * the only keys on the card and the colour is half the instruction.
 */
function KeyRow({ keys }: { readonly keys: readonly KeyHint[] }): ReactNode {
  return (
    <div className={styles.roadKeys}>
      {keys.map(({ cap, what, zone, wide, onPress }) => {
        const face = (
          <>
            <span
              className={clsx(
                styles.roadCap,
                wide === true && styles.roadCapWide,
              )}
              style={{ ["--kz" as never]: `var(--${zone})` }}
            >
              {cap}
            </span>
            <span className={styles.roadCapWhat}>{what}</span>
          </>
        );
        return onPress == null ? (
          <Fragment key={cap}>{face}</Fragment>
        ) : (
          <button
            key={cap}
            type="button"
            className={styles.roadKeyBtn}
            onClick={onPress}
          >
            {face}
          </button>
        );
      })}
    </div>
  );
}
