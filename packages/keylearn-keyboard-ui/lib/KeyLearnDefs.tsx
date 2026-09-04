import { type ReactNode } from "react";
/**
 * The gradients KeyLearn's own caps are painted with.
 *
 * Board-wide rather than per key, exactly as {@link SkinDefs} is for the
 * skinned keysets: sixty caps referencing two gradients costs two gradients,
 * and sixty caps each carrying their own costs sixty. They must live inside
 * the same `<svg>` as the keys or every fill resolves to nothing and the
 * board renders blank.
 *
 * The moulding gradient is neutral — white into nothing into black — rather
 * than mixed from the cap colour. It has to sit over a cap that may be the
 * theme colour or any of the six finger tints, and light on plastic does not
 * change with the plastic.
 */
export function KeyLearnDefs(): ReactNode {
  return (
    <defs>
      {/* A cap is moulded plastic under a light above it: brightest along the
          top edge, falling away, darkest where it meets the wall. Laid OVER
          the cap colour rather than mixed into it, so a finger-zone tint keeps
          its moulding — that is the whole reason this gradient is neutral. A
          flat face is most of why a drawn board reads as drawn, which is the
          point `skins.ts` makes about `alphaTop` and is as true here. */}
      <linearGradient id="kl-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
      </linearGradient>
      {/* One soft light overhead, high and a little left of centre. Its
          STRENGTH is a theme token, not a number here: on a white cap the
          sheen is barely present and on a dark one the same value is a glare
          (owner, 4 Sep 2026). */}
      <radialGradient id="kl-spec" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
