import { type ReactNode } from "react";
import { type Skin } from "./skins.ts";

/**
 * The gradients and filters a skinned board needs, ported from the mock's
 * `defs()`.
 *
 * One set per board, referenced by every cap. The grain is a single overlay
 * over the whole key area rather than a filter per key: a filter per key is
 * ~54 filter regions on a surface that repaints on every keystroke, and that
 * is enough to stall the renderer outright.
 */
export function SkinDefs({ skin }: { readonly skin: Skin }): ReactNode {
  return (
    <defs>
      {grad(`at-${skin.id}`, skin.alphaTop)}
      {grad(`as-${skin.id}`, skin.alphaSkirt)}
      {grad(`mt-${skin.id}`, skin.modTop)}
      {grad(`ms-${skin.id}`, skin.modSkirt)}
      {skin.accentTop != null && grad(`kt-${skin.id}`, skin.accentTop)}
      {skin.accentSkirt != null && grad(`ks-${skin.id}`, skin.accentSkirt)}

      {/* The cylindrical dish: a keycap is scooped, which from above reads as
          the left and right edges of the face going slightly dark. Tried
          shading all four edges as well; it read heavier, not deeper, so it
          stays on the two edges the scoop actually runs across. */}
      <linearGradient id={`dish-${skin.id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000000" stopOpacity=".13" />
        <stop offset="0.22" stopColor="#000000" stopOpacity="0" />
        <stop offset="0.78" stopColor="#000000" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity=".13" />
      </linearGradient>

      <linearGradient id={`gl-${skin.id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={skin.gloss} />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      {/* The round board's own two: the specular, and the pair of shadow
          blurs. Two shadows rather than one is what says the cap is sitting
          on a surface — a single offset blur reads as a sticker. */}
      {skin.geom.round === true && (
        <>
          <radialGradient id={`spec-${skin.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".26" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity=".09" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter
            id={`sht-${skin.id}`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur
              stdDeviation={(skin.geom.shTightBlur ?? 1.6) * 0.62}
            />
          </filter>
          <filter
            id={`shw-${skin.id}`}
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur
              stdDeviation={(skin.geom.shWideBlur ?? 5.5) * 0.62}
            />
          </filter>
          {/* The board-wide grain. 1.5 in the mock's units, which are 55/34
              larger than this board's, so the same visual grain is 2.43 here. */}
          <filter id="round-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="2.43"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </>
      )}

      {skin.grain && (
        <filter id={`grain-${skin.id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.7"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      )}
    </defs>
  );
}

/** A gradient with however many stops the keyset specifies. */
function grad(id: string, stops: readonly string[]): ReactNode {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map((c, i) => (
        <stop
          key={i}
          offset={(i / Math.max(1, stops.length - 1)).toFixed(3)}
          stopColor={c}
        />
      ))}
    </linearGradient>
  );
}
