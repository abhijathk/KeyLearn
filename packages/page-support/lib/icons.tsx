import { type ReactNode } from "react";

/**
 * The small set of glyphs the support section needs.
 *
 * Drawn rather than borrowed from an emoji font: an emoji changes shape
 * between platforms, cannot take the theme's colour, and reads as decoration
 * where these are controls. Each inherits `currentColor`, so the same glyph
 * works on the accent button, in a muted row and in the error state without
 * a second copy.
 */

const PATHS = {
  user: "M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.5 14c0-3.1 2.5-5 5.5-5s5.5 1.9 5.5 5",
  chat: "M13 3H3a1.5 1.5 0 00-1.5 1.5v5A1.5 1.5 0 003 11h1.5v2.6L7.6 11H13a1.5 1.5 0 001.5-1.5v-5A1.5 1.5 0 0013 3z",
  clip: "M11 5.5L6 10.5a2 2 0 002.8 2.8l5.2-5.2a3.5 3.5 0 00-5-5L3.6 8.4a5 5 0 007 7",
  trash: "M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v5M9.5 6.5v5",
  plus: "M8 3v10M3 8h10",
  back: "M9.5 3L5 8l4.5 5",
  lock: "M4 7V5a4 4 0 018 0v2M4.4 7h7.2a1.6 1.6 0 011.6 1.6v3.8a1.6 1.6 0 01-1.6 1.6H4.4a1.6 1.6 0 01-1.6-1.6V8.6A1.6 1.6 0 014.4 7z",
  x: "M4 4l8 8M12 4l-8 8",
  search: "M10.5 10.5L14 14M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z",
  alert: "M8 2l6 11H2zM8 6.5v3M8 11.3v.2",
  wifiOff: "M2 2l12 12M5 9.5a5 5 0 016-.8M2.5 6.6a9 9 0 0111-1.4M8 12.6v.1",
  tick: "M3 8.5l3.5 3.5L13 5",
  download: "M8 2v8M4.5 7L8 10.5 11.5 7M2.5 13.5h11",
  // Fatter in the waist than a textbook star: the thin-armed version
  // collapses into a smudge at the size a rating control wants to be.
  // A solid triangle, pointing the way the message goes. Nudged slightly
  // right of centre so the optical weight sits in the middle of the
  // button — a triangle centred by its bounding box always looks left.
  send: "M4.6 2.6 13.4 8 4.6 13.4Z",
  star: "M8 1.6 9.79 5.53 14.09 6.02 10.9 8.94 11.76 13.18 8 11.05 4.24 13.18 5.1 8.94 1.91 6.02 6.21 5.53Z",
  // The per-reply feedback pair. Drawn, like everything here, because a
  // platform emoji thumb can't take the theme's colour and reads as a
  // reaction sticker where this is a control. Cuff first, then the hand
  // — two subpaths so the stroke stays clean at 15px.
  thumbUp:
    "M2.2 7.8h2.3v5.9H2.2Z M4.5 8.2l3-4.9a1.3 1.3 0 012.4.7V7h2.6a1.4 1.4 0 011.4 1.6l-.8 3.9a1.7 1.7 0 01-1.7 1.4H4.5",
  thumbDown:
    "M2.2 8.2h2.3V2.3H2.2Z M4.5 7.8l3 4.9a1.3 1.3 0 002.4-.7V9h2.6a1.4 1.4 0 001.4-1.6l-.8-3.9a1.7 1.7 0 00-1.7-1.4H4.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  filled = false,
  size = 15,
}: {
  readonly name: IconName;
  /** Only the star has a filled form — a lit star against an unlit one. */
  readonly filled?: boolean;
  readonly size?: number;
}): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.1 : 1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
