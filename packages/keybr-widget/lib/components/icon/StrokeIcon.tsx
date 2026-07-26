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
  | "sun"
  | "moon"
  | "auto";

const shapes: Record<StrokeIconName, ReactNode> = {
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
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M12 16l4-3.5" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
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
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.1 2-2.1 3.4" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.4" />
      <path d="M5.5 20c.8-3.7 3.3-5.5 6.5-5.5s5.7 1.8 6.5 5.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
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
  font: <path d="M5 19l5-14 5 14M6.5 14.5h7M15.5 19l3-8 3 8M16.7 16.5h3.6" />,
  expand: (
    <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M4 15v4a1 1 0 0 0 1 1h4" />
  ),
  collapse: (
    <path d="M4 8h4a1 1 0 0 0 1-1V3M20 8h-4a1 1 0 0 1-1-1V3M15 16h4a1 1 0 0 1 1 1v4M9 16H5a1 1 0 0 0-1 1v4" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    </>
  ),
  tune: (
    <>
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="9" cy="6" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="8" cy="18" r="2.2" />
    </>
  ),
  undo: <path d="M8 5L4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="M16 5l4 4-4 4M20 9H10a6 6 0 0 0 0 12h3" />,
  focus: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
    </>
  ),
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  // A circular arrow — "do this one again".
  restart: (
    <>
      <path d="M20 11.5a8 8 0 1 1-2.3-5.4" />
      <path d="M20 4v4h-4" />
    </>
  ),
  // A chevron and a bar — "move on to the next one".
  skip: (
    <>
      <path d="M7 6l6 6-6 6" />
      <path d="M16 6v12" />
    </>
  ),
  // Day: a sun.
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </>
  ),
  // Night: a crescent moon.
  moon: <path d="M20 14.4A8 8 0 0 1 9.6 4 8 8 0 1 0 20 14.4z" />,
  // Auto (follow the device): the letter A.
  auto: <path d="M6 19l6-14 6 14M8.7 14.4h6.6" />,
  // The keyboard, struck through — "hide it".
  keyboardOff: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h0M15 10h0M7 13.5h6" />
      <path d="M4 4l16 16" />
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
