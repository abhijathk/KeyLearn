import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import {
  type ArtKind,
  artKindOf,
  artPalettes,
  artRandom,
  defaultArtFamily,
} from "./art.ts";
import {
  ART_SHAPES,
  artTexture,
  type Gradient,
  type Shape,
  type Texture,
} from "./shapes.ts";

/**
 * A learner's generated avatar.
 *
 * Everything here is derived from `seed`, including the palette and the
 * texture — there is no Math.random anywhere in the render path, because a
 * picture that differs between the server-rendered markup and the browser's
 * first render is a hydration mismatch, and one that differs between devices
 * is not an avatar.
 */
export function ProfileArt({
  family,
  seed,
  kind = "adult",
  size = 64,
  letter,
  className,
  title,
}: {
  readonly family: string;
  readonly seed: number;
  /**
   * Only consulted when the family is unknown — otherwise the family says
   * which set it belongs to, so no caller can draw the wrong picture.
   */
  readonly kind?: ArtKind;
  readonly size?: number;
  /** The initial to ink over the top, or nothing. Off by default. */
  readonly letter?: string | null;
  readonly className?: ClassName;
  readonly title?: string;
}): ReactNode {
  const owner = artKindOf(family);
  const set = owner ?? kind;
  const known = owner != null ? family : defaultArtFamily(kind);
  const palettes = artPalettes(set);
  const r = artRandom(seed);
  // The palette is the first value off the stream, before any geometry, so
  // shuffling moves the colour along with the shapes.
  const palette = palettes[(r() * palettes.length) | 0];
  // Ids only have to be unique within the document; family and seed already
  // are, and a random suffix would break server rendering.
  const id = `art-${known}-${seed >>> 0}`;
  const { gradients, shapes } = ART_SHAPES[known](r, palette, id);
  const texture = artTexture(r, palette, id, set);

  return (
    <svg
      className={clsx(className)}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx={50} cy={50} r={50} />
        </clipPath>
        {gradients.map((g) => (
          <GradientDef key={g.id} gradient={g} />
        ))}
        <TextureDef texture={texture} />
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={0} y={0} width={100} height={100} fill={palette.ground} />
        {shapes.map((shape, i) => (
          <ShapeNode key={i} shape={shape} />
        ))}
        <rect
          x={0}
          y={0}
          width={100}
          height={100}
          fill={`url(#${texture.id})`}
          fillOpacity={texture.opacity}
        />
        {letter != null && letter !== "" && (
          <text
            x={50}
            y={52}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={44}
            fontWeight={700}
            fill={palette.ink}
            fillOpacity={0.85}
          >
            {letter.toUpperCase()}
          </text>
        )}
      </g>
    </svg>
  );
}

function GradientDef({ gradient }: { readonly gradient: Gradient }): ReactNode {
  const stops = (
    <>
      <stop offset="0%" stopColor={gradient.from} />
      <stop offset="100%" stopColor={gradient.to} />
    </>
  );
  return gradient.radial ? (
    <radialGradient id={gradient.id}>{stops}</radialGradient>
  ) : (
    <linearGradient id={gradient.id} x1="0" y1="0" x2="1" y2="1">
      {stops}
    </linearGradient>
  );
}

function ShapeNode({ shape }: { readonly shape: Shape }): ReactNode {
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
          fillOpacity={shape.opacity}
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
          fillOpacity={shape.opacity}
        />
      );
    case "path":
      return (
        <path
          d={shape.d}
          fill={shape.fill}
          fillOpacity={shape.opacity}
          fillRule={shape.evenOdd ? "evenodd" : undefined}
          transform={shape.transform}
        />
      );
  }
}

function TextureDef({ texture }: { readonly texture: Texture }): ReactNode {
  const { id, which, tint } = texture;
  switch (which) {
    case 0:
      return (
        <pattern
          id={id}
          width={9}
          height={9}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={3.4} height={9} fill={tint} />
        </pattern>
      );
    case 1:
      return (
        <pattern id={id} width={10} height={10} patternUnits="userSpaceOnUse">
          <circle cx={3} cy={3} r={2.1} fill={tint} />
          <circle cx={8} cy={8} r={1.5} fill={tint} />
        </pattern>
      );
    case 2:
      return (
        <pattern
          id={id}
          width={12}
          height={12}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(30)"
        >
          <rect width={12} height={3} fill={tint} />
          <rect width={3} height={12} fill={tint} />
        </pattern>
      );
    case 3:
      return (
        <pattern id={id} width={14} height={14} patternUnits="userSpaceOnUse">
          <path
            d="M0 11 L7 4 L14 11"
            stroke={tint}
            strokeWidth={3}
            fill="none"
          />
        </pattern>
      );
    default:
      return (
        <pattern id={id} width={16} height={16} patternUnits="userSpaceOnUse">
          <circle
            cx={8}
            cy={8}
            r={6.4}
            stroke={tint}
            strokeWidth={2.6}
            fill="none"
          />
        </pattern>
      );
  }
}
