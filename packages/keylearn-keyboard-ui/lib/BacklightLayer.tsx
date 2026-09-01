import { type Keyboard } from "@keylearn/keyboard";
import { memo, type ReactNode } from "react";
import { isHiddenKey } from "./hidden.ts";
import { keyGap, keySize, Surface } from "./shapes.tsx";

/**
 * The per-key backlight.
 *
 * Three blurred layers, all drawn LARGER than the key so their brightest part
 * lands in the gap between caps rather than underneath one. An earlier version
 * put its brightest layer inside the key outline, where the opaque cap covered
 * it completely, and the board read as fog rather than as light escaping from
 * under each key.
 *
 * Every rect blends with `screen`, so where two colours overlap they add the
 * way light does. That is what makes neighbouring keys bleed into each other
 * instead of sitting side by side as flat rectangles.
 *
 * One filter per layer for the whole board, never one per key: 50-odd filter
 * regions is enough to stall the renderer, and this repaints on every
 * keystroke.
 */
export const BacklightLayer = memo(function BacklightLayer({
  keyboard,
  intensity,
  flat,
  cuedKey = null,
  depressedKeys = [],
  cue = "var(--KeyboardKey-pointer__color)",
  warm,
  round = false,
}: {
  readonly keyboard: Keyboard;
  /** 0-100, straight from the setting. */
  readonly intensity: number;
  readonly flat?: boolean;
  /** The key being asked for; its light is tinted and lifted. */
  readonly cuedKey?: string | null;
  /** Keys currently held; they flare. */
  readonly depressedKeys?: readonly string[];
  /** The accent this keyset cues in. */
  readonly cue?: string;
  /** One colour for every key, overriding the per-column hues. The round
      board's light is a warm white: an LED under a cap is the same light
      whatever colour the plastic above it is. */
  readonly warm?: string;
  /** Caps are circles and stadiums, so the light under them has to be too. */
  readonly round?: boolean;
}): ReactNode {
  // Skip the keys the board does not draw, or the light appears in the empty
  // slots either side of the space bar.
  const shapes = [...keyboard.shapes.values()].filter(
    (s) => !isHiddenKey(s.id),
  );
  if (shapes.length === 0) {
    return null;
  }

  if (round) {
    return (
      <RoundBacklight
        shapes={shapes}
        intensity={intensity}
        cuedKey={cuedKey}
        depressedKeys={depressedKeys}
        cue={cue}
        warm={warm ?? "#ffe3ad"}
      />
    );
  }

  // 45 is the default, so the slider reads as a multiplier around it. A flat
  // board's plain white sits a little lower than a saturated per-key sweep,
  // and the round board's one warm white lower again — with no chassis to
  // contain it the light spills across the whole page, so what reads as
  // "lit" on a boxed board reads as haze here.
  const k = (intensity / 45) * (flat ? 0.8 : 1) * (warm != null ? 0.78 : 1);
  const o = (base: number) => Math.min(1, base * k).toFixed(3);

  // Above the middle of the slider the pool spreads further into the gaps
  // rather than washing over the caps: these keycaps are opaque, and on a real
  // board no light comes through the front of one.
  const spread = Math.max(0, (intensity - 55) / 45) * 2.5;
  // On a flat board the LED sits under the front edge, so the light gathers
  // along the bottom and thins towards the top.
  const bias = flat ? 5.5 : 0;

  const lip = flat ? 2 : 5; // matches FLAT.lip / MECH.lip
  const id = flat ? "flat" : "mech";

  const layer = (dx: number, dy: number, dw: number, dh: number, rx: number) =>
    shapes.map((shape) => {
      const x = shape.x * keySize;
      const y = shape.y * keySize;
      const w = shape.w * keySize - keyGap;
      const isPressed = depressedKeys.includes(shape.id);
      const isCued = cuedKey === shape.id;
      // What the light DOES while you type: the key being asked for is lifted
      // and wears the cue colour, the key you just struck flares and spreads.
      // Everything else is ambient. Without the per-rect opacity every layer
      // rendered at full strength and the board came out about twice as bright
      // as the mock.
      const lift = isPressed ? 2.1 : isCued ? 1.2 : 1;
      const g = isPressed ? 2.5 : 0;
      const sp = g + spread;
      return (
        <rect
          key={shape.id}
          x={x + dx - sp}
          y={y + lip + dy - sp + bias * 1.6}
          width={w + dw + sp * 2}
          height={Math.max(4, dh + sp * 2 - bias)}
          rx={rx}
          fill={isCued ? cue : (warm ?? colourOf(flat === true, x))}
          opacity={Math.min(1, 0.55 * lift).toFixed(3)}
          style={{ mixBlendMode: "screen" }}
        />
      );
    });

  return (
    <Surface>
      <g
        style={{ isolation: "isolate" }}
        pointerEvents="none"
        aria-hidden={true}
      >
        <defs>
          <filter
            id={`kbd-amb-${id}`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation={13} />
          </filter>
          <filter
            id={`kbd-pool-${id}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation={6} />
          </filter>
          <filter
            id={`kbd-ring-${id}`}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feGaussianBlur stdDeviation={2.2} />
          </filter>
        </defs>
        <g filter={`url(#kbd-amb-${id})`} opacity={o(0.15)}>
          {layer(-15, -13, 30, 34 + 26, 18)}
        </g>
        <g filter={`url(#kbd-pool-${id})`} opacity={o(0.22)}>
          {layer(-8, -7, 16, 34 + 14, 12)}
        </g>
        <g filter={`url(#kbd-ring-${id})`} opacity={o(0.42)}>
          {layer(-3.5, -3, 7, 34 + 6, 8)}
        </g>
      </g>
    </Surface>
  );
});

/**
 * The round board's light — ONE soft stadium per key, not three rectangles.
 *
 * The three-layer build above grows each rect by a different amount and gives
 * each a fixed corner radius, which is a rounded SQUARE. Under circular caps
 * the layers stack into a rectangle that reads as a back plate behind the
 * board, which is exactly what it looked like. Here the glow keeps the cap's
 * own shape: a stadium whose radius is half its own height, so it is a circle
 * under a 1u cap and a stadium under Shift, Enter and Space.
 *
 * Numbers are the mock's, scaled from its 55-unit cap to this board's 34:
 * inset (-5, -4), grown (+10, +12) and blurred 3.4 there become (-3.1, -2.5),
 * (+6.2, +7.4) and 2.1 here.
 */
function RoundBacklight({
  shapes,
  intensity,
  cuedKey,
  depressedKeys,
  cue,
  warm,
}: {
  readonly shapes: readonly { id: string; x: number; y: number; w: number }[];
  readonly intensity: number;
  readonly cuedKey: string | null;
  readonly depressedKeys: readonly string[];
  readonly cue: string;
  readonly warm: string;
}): ReactNode {
  const k = intensity / 45;
  const h = keySize - keyGap;
  // The cap body sits ROUND.lip below its slot, and the light is measured from
  // the body, not the slot — otherwise it rides high and pools above the cap.
  const lip = 3;
  const gh = h + 7.4;

  return (
    <Surface>
      <g
        style={{ isolation: "isolate" }}
        pointerEvents="none"
        aria-hidden={true}
      >
        <defs>
          <filter
            id="kbd-soft-round"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation={2.1} />
          </filter>
        </defs>
        <g filter="url(#kbd-soft-round)">
          {shapes.map((shape) => {
            const isCued = cuedKey === shape.id;
            // .22 ambient, .55 under a key being held, and the cue sits at the
            // midpoint of the mock's .5-.95 breath. CueGlowLayer does the
            // breathing itself; this rect only has to be lit under it.
            const base = isCued
              ? 0.72
              : depressedKeys.includes(shape.id)
                ? 0.55
                : 0.22;
            return (
              <rect
                key={shape.id}
                x={shape.x * keySize - 3.1}
                y={shape.y * keySize + lip - 2.5}
                width={shape.w * keySize - keyGap + 6.2}
                height={gh}
                rx={gh / 2}
                fill={isCued ? cue : warm}
                opacity={Math.min(1, base * k).toFixed(3)}
              />
            );
          })}
        </g>
      </g>
    </Surface>
  );
}

/**
 * A flat board has one plain warm backlight, which is what those keyboards
 * actually have. Only the mechanical board runs per-key RGB, swept across the
 * width so each column carries its own hue.
 */
function colourOf(flat: boolean, x: number): string {
  if (flat) {
    return "#fff2dc";
  }
  return `hsl(${Math.round((x / 584) * 300 + 8)} 96% 56%)`;
}
