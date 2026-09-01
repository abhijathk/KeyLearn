import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import {
  type ArtKind,
  artKindOf,
  type ArtPalette,
  artPalettes,
  artRandom,
  vividHex,
} from "./art.ts";
import { ART_SHAPES, type Shape } from "./shapes.ts";

/**
 * The same generator as a learner's avatar, drawn large and uncropped so it
 * can sit in the corner of a card.
 *
 * It is deliberately the same twelve families, the same seed and the same
 * palette: a card carrying the painting from somebody's own avatar is theirs
 * at a glance, without their name being on it. Two things differ from
 * {@link ProfileArt} — there is no circular crop, and the ground is drawn but
 * feathered rather than cropped to a disc. The ground has to be there: several
 * families are compositions of shapes *on* a ground, and without it their
 * negative space is a hole showing whatever the card is sitting on. On a dark
 * card that reads as black wedges punched through the artwork.
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
  vivid = 0,
  letter = null,
  letterSize = 44,
  className,
}: {
  readonly family: string;
  readonly seed: number;
  readonly kind?: ArtKind;
  readonly opacity?: number;
  /**
   * Lift the palette's intensity without moving its hues. The grown-up set is
   * mixed for a 28px avatar and reads as washed out at card size.
   */
  readonly vivid?: number;
  /**
   * The initial to ink over the painting, or nothing. Off by default: the
   * card and the panel header this was written for are backdrops, and a
   * letter across a backdrop is a watermark nobody asked for.
   *
   * It lives HERE rather than in the caller's stylesheet because the ink is
   * the palette's own, and the palette is resolved from the seed in this
   * function — an overlay drawn outside would have to guess a colour, and
   * would drift from the round avatar of the same learner the moment either
   * side changed.
   */
  readonly letter?: string | null;
  /**
   * Cap height for that letter, in viewBox units, where 100 is the whole
   * painting. Defaults to ProfileArt's 44 — right for a circular avatar,
   * where the letter IS the subject. On a band sliced out of the painting the
   * scale is driven by the band's WIDTH, so 44 comes out nearly as tall as
   * the band itself and the artwork becomes a background for a letter rather
   * than a painting with an initial on it.
   */
  readonly letterSize?: number;
  readonly className?: ClassName;
}): ReactNode {
  const owner = artKindOf(family);
  const set = owner ?? kind;
  const known = owner != null ? family : "flow";
  const palettes = artPalettes(set);
  const r = artRandom(seed);
  // The palette comes off the stream first, exactly as it does for the avatar,
  // so a given seed draws the same picture in the same colours in both places.
  const palette = brighten(palettes[(r() * palettes.length) | 0], vivid);
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
      <rect x={-50} y={-50} width={200} height={200} fill={palette.ground} />
      {shapes.map((shape, i) => (
        <MotifShape key={i} shape={shape} />
      ))}
      {/* Same position, size, weight, colour and opacity ProfileArt uses, so
          a learner's initial reads identically whether it is sitting on their
          round avatar or on a band sliced out of the same painting. */}
      {letter != null && letter !== "" && (
        <text
          x={50}
          y={52}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={letterSize}
          fontWeight={700}
          fill={palette.ink}
          fillOpacity={0.85}
        >
          {letter.toUpperCase()}
        </text>
      )}
    </svg>
  );
}

/** The palette with every colour lifted by the same amount. */
export function brighten(palette: ArtPalette, amount: number): ArtPalette {
  if (amount <= 0) {
    return palette;
  }
  return {
    ground: vividHex(palette.ground, amount * 0.55),
    wash: [
      vividHex(palette.wash[0], amount),
      vividHex(palette.wash[1], amount),
      vividHex(palette.wash[2], amount),
    ],
    ink: vividHex(palette.ink, amount * 0.4),
  };
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

/**
 * The same composition as {@link ArtMotif}, as an SVG string.
 *
 * Exists so that anything rasterising a motif — the share card writing a PNG —
 * draws the identical picture rather than a second implementation of it. It
 * builds the markup directly instead of rendering the component to a string,
 * which keeps a server renderer out of the browser bundle.
 */
export function motifMarkup({
  family,
  seed,
  kind = "adult",
  size = 1024,
  vivid = 0,
}: {
  readonly family: string;
  readonly seed: number;
  readonly kind?: ArtKind;
  readonly size?: number;
  readonly vivid?: number;
}): string {
  const owner = artKindOf(family);
  const set = owner ?? kind;
  const known = owner != null ? family : "flow";
  const palettes = artPalettes(set);
  const r = artRandom(seed);
  const palette = brighten(palettes[(r() * palettes.length) | 0], vivid);
  const id = `m${seed >>> 0}`;
  const { gradients, shapes } = ART_SHAPES[known](r, palette, id);
  const defs = gradients
    .map(
      (g) =>
        `<linearGradient id="${g.id}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${g.from}"/>` +
        `<stop offset="100%" stop-color="${g.to}"/>` +
        `</linearGradient>`,
    )
    .join("");
  const body =
    `<rect x="-50" y="-50" width="200" height="200"` +
    ` fill="${palette.ground}"/>` +
    shapes.map(shapeMarkup).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
    ` viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs}</defs>${body}</svg>`
  );
}

function shapeMarkup(shape: Shape): string {
  const t =
    "transform" in shape && shape.transform != null
      ? ` transform="${shape.transform}"`
      : "";
  switch (shape.kind) {
    case "rect":
      return (
        `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}"` +
        ` height="${shape.h}"${shape.rx != null ? ` rx="${shape.rx}"` : ""}` +
        ` fill="${shape.fill}" opacity="${shape.opacity}"${t}/>`
      );
    case "circle":
      return (
        `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"` +
        ` fill="${shape.fill}" opacity="${shape.opacity}"/>`
      );
    case "path":
      return (
        `<path d="${shape.d}" fill="${shape.fill}"` +
        ` opacity="${shape.opacity}"` +
        `${shape.evenOdd ? ` fill-rule="evenodd"` : ""}${t}/>`
      );
  }
}
