import { type KeyShape, useKeyboard, type ZoneId } from "@keylearn/keyboard";
import { type Point } from "@keylearn/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import handLeft from "../assets/hand-left.png";
import handRight from "../assets/hand-right.png";
import { getKeyCenter, keyGap, keySize, Surface } from "./shapes.tsx";
import * as styles from "./ZonesLayer.module.less";

export const ZonesLayer = memo(function ZonesLayer(): ReactNode {
  const keyboard = useKeyboard();
  const findHomingKey = (zone: ZoneId): KeyShape | null => {
    for (const shape of keyboard.shapes.values()) {
      if (shape.homing && shape.inZone(zone)) {
        return shape;
      }
    }
    return null;
  };
  const l = findHomingKey("left") ?? keyboard.getShape("KeyF");
  const r = findHomingKey("right") ?? keyboard.getShape("KeyJ");
  // The thumbs rest on the space bar, so that is what fixes the hands
  // vertically — measuring it from the board rather than assuming two rows
  // keeps them right on layouts whose bottom row sits elsewhere.
  const space = keyboard.getShape("Space");
  if (l != null && r != null) {
    const restY = space != null ? getKeyCenter(space).y : null;
    // Where the plastic stops and the page starts. A hand is drawn across both
    // and has to read on both, so this is the line its ink changes on.
    let boardBottom = 0;
    for (const shape of keyboard.shapes.values()) {
      boardBottom = Math.max(
        boardBottom,
        shape.y * keySize + shape.h * (keySize - keyGap),
      );
    }
    return (
      <Surface>
        <Hand
          side="left"
          center={getKeyCenter(l)}
          restY={restY}
          boardBottom={boardBottom}
        />
        <Hand
          side="right"
          center={getKeyCenter(r)}
          restY={restY}
          boardBottom={boardBottom}
        />
      </Surface>
    );
  } else {
    return null;
  }
});

/**
 * The resting hands, drawn from the artwork rather than from hand-written
 * paths.
 *
 * The image travels as a single-channel mask instead of a colour picture: the
 * render is essentially grey, so its shading survives as opacity while the
 * colour still comes from `var(--secondary)` — which is what lets one drawing
 * sit on a night ground and a daylight one. It also takes the file from 585 KB
 * to under 60 KB a hand.
 *
 * Nothing here is eyeballed. Each hand's fingertips and thumb tip were measured
 * in the artwork; the little and index fingertips are three key pitches apart
 * on the home row, which fixes the scale, the index tip fixes it horizontally
 * over F or J, and the thumb tip fixes it vertically over the space bar. Both
 * hands independently give a width of ~269 units, which is the check that the
 * measurements are sound.
 */
const hands = {
  left: {
    href: handLeft,
    width: 269.3,
    height: 361.6,
    tipX: 0.8291,
    tipY: 0.0,
    thumbY: 0.238,
    // The watch face, as a fraction of the artwork. Measured from the render.
    // The face spans 0.145..0.355 of the hand's width and 0.555..0.720 of its
    // height — measured off the artwork, which is also where the type size
    // comes from, so the time sits inside the case with a margin either side.
    //
    // The tilt does not follow the case's own top edge (-17 degrees). The arm
    // runs up and to the right, and a watch is read along the arm rather than
    // square to the world, so the time is carried round anticlockwise to sit
    // with it.
    watch: { x: 0.234, y: 0.6375, size: 0.078, tilt: -67 },
  },
  right: {
    href: handRight,
    width: 268.5,
    height: 359.3,
    tipX: 0.1061,
    tipY: 0.0013,
    thumbY: 0.232,
    watch: null,
  },
} as const;

/**
 * How much of a hand's height the ink takes to change over, as a fraction.
 *
 * A quarter is a lot, and that is the point: the eye finds a gradient's ends
 * long before it finds its middle, so the only way to hide the change is to
 * make it longer than the feature it crosses.
 */
const RAMP = 0.26;

const Hand = memo(function Hand({
  side,
  center: { x, y },
  restY,
  boardBottom,
}: {
  side: keyof typeof hands;
  center: Point;
  restY: number | null;
  boardBottom: number;
}): ReactNode {
  const hand = hands[side];
  const { href, width, height, tipX, tipY, thumbY } = hand;
  const id = `zones-hand-${side}`;
  // Horizontally by the index finger, vertically by the thumb. Falling back to
  // the fingertip only if the board has no space bar to rest on.
  const left = x - tipX * width;
  const top = restY != null ? restY - thumbY * height : y - tipY * height;
  // The board's edge, as a fraction of this hand's own height — which is what
  // an objectBoundingBox gradient measures its stops in.
  const edge = Math.min(1, Math.max(0, (boardBottom - top) / height));
  return (
    <g className={styles.figure} transform={`translate(${left} ${top})`}>
      <defs>
        <mask id={id} maskContentUnits="objectBoundingBox">
          <image href={href} width="1" height="1" preserveAspectRatio="none" />
        </mask>
        {/* One hand, two grounds. The fingers lie on the keyset and the wrist
            lies on the page, and on a dark board over a light theme those two
            want opposite ink: pale to read against near-black caps, dark to
            read against the page below them. A single flat fill can only ever
            get one of them right — filling it dark lost the fingers, filling
            it pale lost the two thirds of the hand that hangs off the board.
            So the ink changes where the ground does. Above the line it is the
            colour the keyset prints its own legends in; below it, the page's.
            On the unskinned board both stops resolve to the same value and
            this is exactly the flat fill it has always been. */}
        <linearGradient
          id={`${id}-ink`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {/* The ramp is long on purpose. At a 2% band the two inks met in a
              visible straight line across the palms — a seam exactly where
              there is nothing in the artwork to justify one. Over a quarter
              of the hand there is no edge to find: the change happens across
              the palm, which is the widest, flattest, least detailed part of
              the drawing and the one place a colour can move without anything
              appearing to happen.

              It is also carried mostly ABOVE the board's edge rather than
              centred on it. The fingers have to stay in the board's own ink to
              read against the caps, and they occupy the top of the hand — so
              the ramp starts late enough to leave them alone and finishes just
              past the edge, where the wrist is already over the page. */}
          <stop
            offset={Math.max(0, edge - RAMP * 0.72)}
            className={styles.inkBoard}
          />
          {/* A midpoint at the board's own line. Two stops alone put the
              halfway colour halfway along the ramp, which on an asymmetric
              ramp is not where the ground actually changes. */}
          <stop offset={edge} className={styles.inkMid} />
          <stop
            offset={Math.min(1, edge + RAMP * 0.28)}
            className={styles.inkPage}
          />
        </linearGradient>
        {/* One blur for a whole hand, not one per part. */}
        <filter id={`${id}-cast`} x="-10%" y="-10%" width="125%" height="125%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
      </defs>
      {/* The shadow the hand casts on whatever is under it.
          The pale fill alone has no edge: over the near-black caps of the Flat,
          Mechanical and Round boards a hand became a milky wash you could not
          read a finger out of. A hand resting on a keyboard darkens the keys
          beneath it, and that darkening is what draws the silhouette — so the
          same artwork is drawn once more underneath, offset down-right, soft,
          and nearly black. It is the shadow doing the outlining, which means
          nothing has to be drawn as an outline. */}
      <g transform="translate(3 4)" filter={`url(#${id}-cast)`}>
        <rect
          className={styles.cast}
          width={width}
          height={height}
          mask={`url(#${id})`}
        />
      </g>
      <rect
        className={styles.hand}
        fill={`url(#${id}-ink)`}
        width={width}
        height={height}
        mask={`url(#${id})`}
      />
      {hand.watch != null && <Watch hand={hand} />}
    </g>
  );
});

/**
 * The time, on the watch the artwork is already wearing.
 *
 * Hours and minutes only, with the colon breathing once a second — the way a
 * watch face does. The minute is what anybody glances down for; seconds as
 * digits would be a thing that moves in the corner of your eye while you are
 * trying to read.
 */
function Watch({ hand }: { hand: (typeof hands)["left"] }): ReactNode {
  const { watch, width, height } = hand;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Ten seconds is plenty for a clock that shows minutes, and it keeps this
    // off the per-second render path of a page built for typing latency.
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const cx = watch.x * width;
  const cy = watch.y * height;
  const size = watch.size * width;
  // Twelve-hour, zero padded, and no meridiem — a watch face has no room for
  // "am", and nobody glancing at their wrist is in any doubt which half of the
  // day it is. Midnight and noon both read as 12, the way a clock does.
  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <text
      className={styles.watch}
      x={cx}
      y={cy}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
      // Rotated onto the face, then squeezed narrow and stretched tall — the
      // proportions a watch uses, where the numerals have to carry at a glance
      // in a space far wider than it is high.
      transform={
        `rotate(${watch.tilt} ${cx} ${cy})` +
        ` translate(${cx} ${cy}) scale(0.66 1.48) translate(${-cx} ${-cy})`
      }
    >
      {hh}
      <tspan className={styles.tick}>:</tspan>
      {mm}
    </text>
  );
}
