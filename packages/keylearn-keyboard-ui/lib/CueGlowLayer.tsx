import { type KeyId, useKeyboard } from "@keylearn/keyboard";
import { useSettings } from "@keylearn/settings";
import { memo, type ReactNode } from "react";
import * as styles from "./CueGlowLayer.module.less";
import { useSkin } from "./lighting.ts";
import { keyGap, keySize, Surface } from "./shapes.tsx";

/**
 * The next key, shown as light rather than as a marker.
 *
 * Rendered BEFORE the keys so it paints underneath them. Drawn after, it sits
 * on top of the cap and reads as a coloured sticker rather than as light
 * escaping from under the key — which is the whole difference between this and
 * a ring.
 *
 * Same three-layer shape as the backlight, in the accent instead of the key's
 * own hue, so it reads as that key being lit harder rather than as a different
 * kind of thing. The breathing is a CSS animation on the group that CONTAINS
 * the filters: animating a filter's input re-runs the blur every frame, and
 * this repaints on every keystroke.
 */
export const CueGlowLayer = memo(function CueGlowLayer({
  cuedKey,
  urgent = false,
  lip = 0,
  cue = "var(--KeyboardKey-pointer__color)",
  soleLight = false,
  intensity = 45,
}: {
  readonly cuedKey: KeyId | null;
  readonly urgent?: boolean;
  /** Visible wall below the cap; the light is measured from the cap body. */
  readonly lip?: number;
  /** This keyset's accent. */
  readonly cue?: string;
  /**
   * Set when the cue is the ONLY light on the board — a mechanical keyboard
   * with its backlight off. It has to punch harder there because it is
   * competing with a lit room rather than a dark one. While the board IS lit
   * the cue tracks the intensity slider like every other layer, or turning the
   * light down leaves one key blazing.
   */
  readonly soleLight?: boolean;
  /** 0-100, straight from the setting. */
  readonly intensity?: number;
}): ReactNode {
  const keyboard = useKeyboard();
  // Hooks before the early returns, unconditionally — a hook after a
  // conditional return runs on some renders and not others, which corrupts
  // React's hook order the moment the cue appears or vanishes.
  const { settings } = useSettings();
  const round = useSkin(settings)?.geom.round === true;
  if (cuedKey == null) {
    return null;
  }
  const shape = keyboard.getShape(cuedKey);
  if (shape == null) {
    return null;
  }

  const x = shape.x * keySize;
  const y = shape.y * keySize;
  const w = shape.w * keySize - keyGap;
  const h = shape.h * keySize - keyGap;
  const k = intensity / 45;
  const o = (base: number) => Math.min(1, base * k).toFixed(3);

  /* Each layer is grown by (dw, dh), so its radius has to grow with it — on
     the round board a stadium that keeps the cap's own radius while getting
     28 units taller stops being a stadium. `radius` answers for the grown
     height, not the cap's. */
  const layer = (
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    rx: number,
  ) => (
    <rect
      x={x - dx}
      y={y + lip - dy}
      width={w + dw}
      height={h + dh}
      rx={round ? (h + dh) / 2 : rx}
      fill={cue}
      style={{ mixBlendMode: "screen" }}
    />
  );

  return (
    <Surface>
      <g
        className={urgent ? styles.urgent : styles.breathe}
        style={{ isolation: "isolate" }}
        pointerEvents="none"
        aria-hidden={true}
      >
        <defs>
          <filter id="cue-amb" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={13} />
          </filter>
          <filter id="cue-pool" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={6} />
          </filter>
          <filter id="cue-ring" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation={2.2} />
          </filter>
        </defs>
        <g filter="url(#cue-amb)" opacity={soleLight ? 0.34 : o(0.22)}>
          {layer(16, 14, 32, 28, 18)}
        </g>
        <g filter="url(#cue-pool)" opacity={soleLight ? 0.56 : o(0.34)}>
          {layer(9, 8, 18, 16, 12)}
        </g>
        <g filter="url(#cue-ring)" opacity={soleLight ? 0.92 : o(0.58)}>
          {layer(4, 3.5, 8, 7, 8)}
        </g>
      </g>
    </Surface>
  );
});
