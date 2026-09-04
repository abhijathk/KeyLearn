import { clsx } from "clsx";
import { type ReactNode } from "react";
import { type ClassName } from "../types.ts";
import * as styles from "./StrokeIcon.module.less";

/**
 * A bespoke thin-line icon, drawn for KeyLearn in one consistent visual
 * language (1.7px stroke, rounded caps/joins). Uses `currentColor`, so it
 * adapts to the surrounding text/button colour and to the active theme.
 */
export type StrokeIconName =
  | "keyboard"
  | "chart"
  | "gauge"
  | "crown"
  | "trophy"
  | "people"
  | "grid"
  | "help"
  | "user"
  | "menu"
  | "close"
  | "mail"
  | "code"
  | "doc"
  | "shield"
  | "translate"
  | "globe"
  | "theme"
  | "font"
  | "expand"
  | "collapse"
  | "settings"
  | "tune"
  | "undo"
  | "redo"
  | "restart"
  | "skip"
  | "keyboardOff"
  | "focus"
  | "back"
  | "chevronLeft"
  | "sun"
  | "moon"
  | "auto"
  | "book"
  | "heart"
  | "braille"
  | "warning"
  | "info"
  | "copy"
  | "bell"
  | "headset"
  | "coffee"
  | "arrowRight";

const shapes: Record<StrokeIconName, ReactNode> = {
  // The cell for "b": dots 1 and 2 raised, the other four empty.
  braille: (
    <>
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </>
  ),
  heart: (
    <path d="M12 20.2s-7.6-4.6-7.6-9.6a4.3 4.3 0 0 1 7.6-2.8 4.3 4.3 0 0 1 7.6 2.8c0 5-7.6 9.6-7.6 9.6Z" />
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h0M11 10h0M15 10h0M7 13.5h10" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 14l3.5-4 3 2.5L20 7" />
    </>
  ),
  gauge: (
    <>
      <path d="M3.8 16.8a8.2 8.2 0 1 1 16.4 0" />
      <path d="m12 16.8 4.6-5.6" />
      <circle cx="12" cy="16.8" r="1.2" />
      <path d="M5.6 13.4h1.4M17 13.4h1.4M12 6.6V8" />
    </>
  ),
  crown: <path d="M4 8l3.5 3L12 6l4.5 5L20 8l-1.5 9h-13z" />,
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" />
      <path d="M12 13v3M9 20h6M9.5 20c0-1.7.8-2.6 2.5-2.6s2.5.9 2.5 2.6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="2.6" />
      <circle cx="16.5" cy="10" r="2.1" />
      <path d="M4 19c.6-3 2.6-4.5 5-4.5S13.4 16 14 19M15 15c1.9.1 3.4 1.3 4 4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.5 9.4a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2.1-2.4 3.7" />
      <path d="M12 17.2h0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.2 20.2a7.8 7.8 0 0 1 15.6 0" />
    </>
  ),
  menu: <path d="M3.6 7.2h16.8M3.6 12h16.8M3.6 16.8h16.8" />,
  close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3.4a6.1 6.1 0 0 0-6.1 6.1c0 4.4-1.7 6.3-1.7 6.3h15.6S18.1 13.9 18.1 9.5A6.1 6.1 0 0 0 12 3.4Z" />
      <path d="M9.7 18.6a2.3 2.3 0 0 0 4.6 0" />
      <path d="M12 2v1.4" />
    </>
  ),
  code: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />,
  doc: (
    <>
      <path d="M6.5 3.5h7L18 8v12.5H6.5z" />
      <path d="M13 3.5V8h5M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z" />
      <path d="M9 12l2 2 4-4.5" />
    </>
  ),
  translate: (
    <>
      <path d="M4 6h8M8 6c0 5-2 8-4 9.5M6 10c.5 2.5 2.5 4 5 5" />
      <path d="M13.5 20l3.5-9 3.5 9M15 17h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  font: (
    <>
      <path d="M5.6 19 12 5l6.4 14" />
      <path d="M8.2 14.2h7.6" />
    </>
  ),
  expand: (
    <path d="M9.4 3.6H4.8a1.2 1.2 0 0 0-1.2 1.2v4.6M14.6 3.6h4.6a1.2 1.2 0 0 1 1.2 1.2v4.6M20.4 14.6v4.6a1.2 1.2 0 0 1-1.2 1.2h-4.6M3.6 14.6v4.6a1.2 1.2 0 0 0 1.2 1.2h4.6" />
  ),
  collapse: (
    <path d="M3.6 9.4h4.6a1.2 1.2 0 0 0 1.2-1.2V3.6M20.4 9.4h-4.6a1.2 1.2 0 0 1-1.2-1.2V3.6M14.6 20.4v-4.6a1.2 1.2 0 0 1 1.2-1.2h4.6M9.4 20.4v-4.6a1.2 1.2 0 0 0-1.2-1.2H3.6" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="6.3" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3.2v2.5M12 18.3v2.5M20.8 12h-2.5M5.7 12H3.2M18.2 5.8l-1.8 1.8M7.6 16.4l-1.8 1.8M18.2 18.2l-1.8-1.8M7.6 7.6 5.8 5.8" />
    </>
  ),
  tune: (
    <>
      <path d="M3.6 7.6h9.4M17.4 7.6h3M3.6 16.4h3M11 16.4h9.4" />
      <circle cx="15.2" cy="7.6" r="2.1" />
      <circle cx="8.8" cy="16.4" r="2.1" />
    </>
  ),
  undo: <path d="M8 5L4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="M16 5l4 4-4 4M20 9H10a6 6 0 0 0 0 12h3" />,
  focus: (
    <>
      <path d="M3.4 8.6V5.4a2 2 0 0 1 2-2h3.2M15.4 3.4h3.2a2 2 0 0 1 2 2v3.2M20.6 15.4v3.2a2 2 0 0 1-2 2h-3.2M8.6 20.6H5.4a2 2 0 0 1-2-2v-3.2" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  // The same direction as `back` with the shaft removed. A separate name
  // rather than a change to `back`, because that one also labels Log out in
  // the menu drawer, where a bare chevron would point without saying
  // anything.
  chevronLeft: <path d="M15 5.5 8.5 12 15 18.5" />,
  // A circular arrow — "do this one again".
  restart: (
    <>
      <path d="M20 12a8 8 0 1 1-2.9-6.2" />
      <path d="M20.4 4.4v4.9h-4.9" />
    </>
  ),
  skip: (
    <>
      <path d="M6.2 5.6v12.8L16 12 6.2 5.6Z" />
      <path d="M18.4 5.6v12.8" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.35 5.35l1.7 1.7M16.95 16.95l1.7 1.7M18.65 5.35l-1.7 1.7M7.05 16.95l-1.7 1.7" />
    </>
  ),
  moon: (
    <>
      <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z" />
      <path d="M16.6 3.4v2.6M15.3 4.7h2.6" />
    </>
  ),
  auto: (
    <>
      <circle cx="12" cy="12" r="6.2" />
      <path
        d="M12 5.8a6.2 6.2 0 0 1 0 12.4Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  book: (
    <path d="M12 6.4C10.4 5 7.9 4.6 4.5 4.9V17c3.4-.3 5.9.1 7.5 1.6M12 6.4c1.6-1.4 4.1-1.8 7.5-1.5V17c-3.4-.3-5.9.1-7.5 1.6M12 6.4V18.6" />
  ),
  // A caution triangle — blocking warnings, spoken calmly.
  warning: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // A plain "i" — neutral notices, not errors.
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Two overlapping rectangles — "copy this".
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  // The keyboard, struck through — "hide it".
  keyboardOff: (
    <>
      <path d="M8.6 5.6h10.6a2.4 2.4 0 0 1 2.4 2.4v8a2.4 2.4 0 0 1-1 1.9M17 18.4H4.8A2.4 2.4 0 0 1 2.4 16V8a2.4 2.4 0 0 1 2.1-2.4" />
      <path d="M6.2 9.6h0M9.6 13.6h5.6" />
      <path d="M3 3l18 18" />
    </>
  ),
  headset: (
    <>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="2.5" y="12.5" width="4" height="6.5" rx="1.8" />
      <rect x="17.5" y="12.5" width="4" height="6.5" rx="1.8" />
      <path d="M19.5 19v0.5a3 3 0 0 1-3 3h-2.5" />
    </>
  ),
  // "Buy me a coffee". Drawn rather than the photograph it replaces: a
  // raster cup could not take the theme's colour, so it stayed the same
  // warm brown on a dark header while every icon beside it turned pale.
  arrowRight: <path d="M5 12h13M12 5l7 7-7 7" />,
  coffee: (
    <>
      <path d="M9.2 4.8V3.4a.8.8 0 0 1 .8-.8h4a.8.8 0 0 1 .8.8v1.4" />
      <path d="M4.5 8.8 5.9 5.5a1.2 1.2 0 0 1 1.1-.7h10a1.2 1.2 0 0 1 1.1.7l1.4 3.3Z" />
      <path d="M5.4 8.8h13.2l-1.5 11.1a1.6 1.6 0 0 1-1.59 1.4H8.49a1.6 1.6 0 0 1-1.59-1.4Z" />
    </>
  ),
};

export function StrokeIcon({
  name,
  className,
  title,
}: {
  readonly name: StrokeIconName;
  readonly className?: ClassName;
  readonly title?: string;
}): ReactNode {
  return (
    <svg
      className={clsx(styles.root, className)}
      viewBox="0 0 24 24"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {shapes[name]}
    </svg>
  );
}
