import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { type ArtKind, artKindOf, artPalettes, artRandom } from "./art.ts";
import { ART_SHAPES, type Shape } from "./shapes.ts";

/**
 * The same generator as a learner's avatar, drawn large and uncropped so it
 * can sit in the corner of a card.
 *
 * It is deliberately the same twelve families, the same seed and the same
 * palette: a card carrying the painting from somebody's own avatar is theirs
 * at a glance, without their name being on it. Two things differ from
 * {@link ProfileArt} — there is no circular crop and no ground fill, because
 * the motif sits on top of a background the card has already chosen.
 *
 * Feathering the edge is left to the caller's stylesheet rather than done with
 * an SVG mask here. With preserveAspectRatio="slice" the viewBox is scaled to
 * cover and then cropped, so a mask in user space lands somewhere the viewer
 * never sees; a CSS mask applies to the element box, which is the thing whose
 * edge is actually visible.
 */
export function ArtMotif({
  family,
  seed,
  kind = "adult",
  opacity = 1,
  className,
}: {
  readonly family: string;
  readonly seed: number;
  readonly kind?: ArtKind;
  readonly opacity?: number;
  readonly className?: ClassName;
}): ReactNode {
  const owner = artKindOf(family);
  const set = owner ?? kind;
  const known = owner != null ? family : "flow";
  const palettes = artPalettes(set);
  const r = artRandom(seed);
  // The palette comes off the stream first, exactly as it does for the avatar,
  // so a given seed draws the same picture in the same colours in both places.
  const palette = palettes[(r() * palettes.length) | 0];
  const id = `motif-${known}-${seed >>> 0}`;
  const { gradients, shapes } = ART_SHAPES[known](r, palette, id);

  return (
    <svg
      className={clsx(className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden={true}
      style={{ opacity }}
    >
      <defs>
        {gradients.map((g) => (
          <linearGradient
            key={g.id}
            id={g.id}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={g.from} />
            <stop offset="100%" stopColor={g.to} />
          </linearGradient>
        ))}
      </defs>
      {shapes.map((shape, i) => (
        <MotifShape key={i} shape={shape} />
      ))}
    </svg>
  );
}

function MotifShape({ shape }: { readonly shape: Shape }): ReactNode {
  switch (shape.kind) {
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          fill={shape.fill}
          opacity={shape.opacity}
          transform={shape.transform}
        />
      );
    case "circle":
      return (
        <circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.fill}
          opacity={shape.opacity}
        />
      );
    case "path":
      return (
        <path
          d={shape.d}
          fill={shape.fill}
          opacity={shape.opacity}
          transform={shape.transform}
          fillRule={shape.evenOdd ? "evenodd" : undefined}
        />
      );
  }
}
