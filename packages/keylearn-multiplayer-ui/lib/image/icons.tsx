import { type ClassName } from "@keylearn/widget";
import { memo, type ReactNode } from "react";

/**
 * The multiplayer icon set, drawn rather than borrowed.
 *
 * System emoji were the obvious shortcut and are the wrong answer here: they
 * render differently on every platform, they cannot take the accent colour, and
 * the full emoji keyboard contains a great deal that has no place in an app
 * children have open. These follow the rule the rest of the app already uses —
 * no fill, 1.7 stroke, round caps and joins, on a 24 grid — and inherit
 * `currentColor`, so one glyph works muted in a system line and mint in a
 * quick phrase.
 *
 * They double as the chat palette: a closed set cannot be abusive, so the
 * quick phrases need no filtering at all.
 */

function icon(name: string, path: ReactNode) {
  const Icon = memo(function Icon({
    className,
    title,
  }: {
    readonly className?: ClassName;
    readonly title?: string;
  }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title == null ? "presentation" : "img"}
        aria-hidden={title == null ? true : undefined}
      >
        {title != null && <title>{title}</title>}
        {path}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const PeopleIcon = icon(
  "PeopleIcon",
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.4 2.7-5.2 6-5.2s6 1.8 6 5.2" />
    <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9" />
    <path d="M17.5 15c2.4.5 4.5 2.1 4.5 5" />
  </>,
);

export const TimerIcon = icon(
  "TimerIcon",
  <>
    <circle cx="12" cy="13.4" r="7.6" />
    <path d="M12 9.6v3.8l2.6 2.2" />
    <path d="M9.4 2.6h5.2" />
  </>,
);

export const ShuffleIcon = icon(
  "ShuffleIcon",
  <>
    <path d="M3 7h3.5l3 4" />
    <path d="M14.5 17H18" />
    <path d="M3 17h3.5l7-10H18" />
    <path d="M15.6 4.6 18.4 7l-2.8 2.4" />
    <path d="M15.6 14.6 18.4 17l-2.8 2.4" />
  </>,
);

export const MaskIcon = icon(
  "MaskIcon",
  <>
    <path d="M3.6 8.4c4-1.5 12.8-1.5 16.8 0 .5 4.4-1 8.6-3.5 8.6-1.8 0-2.6-1.3-4.9-1.3s-3.1 1.3-4.9 1.3c-2.5 0-4-4.2-3.5-8.6Z" />
    <path d="M7.6 11.2h1.8" />
    <path d="M14.6 11.2h1.8" />
  </>,
);

export const SparkIcon = icon(
  "SparkIcon",
  <path d="M12 3.5 13.7 10 20 11.8 13.7 13.6 12 20.2 10.3 13.6 4 11.8 10.3 10Z" />,
);

export const FlagIcon = icon(
  "FlagIcon",
  <>
    <path d="M6 21V3.6" />
    <path d="M6 4.6h11l-2.2 3.9L17 12.4H6" />
  </>,
);

export const RiseIcon = icon(
  "RiseIcon",
  <>
    <path d="M6.5 13.5 12 8l5.5 5.5" />
    <path d="M6.5 19 12 13.5 17.5 19" />
  </>,
);

export const LoopIcon = icon(
  "LoopIcon",
  <>
    <path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8" />
    <path d="M20.4 3.4v4.4H16" />
  </>,
);

export const SendIcon = icon(
  "SendIcon",
  <>
    <path d="M4 12h13" />
    <path d="M12.4 6.6 17.8 12l-5.4 5.4" />
  </>,
);

export const EnterIcon = icon(
  "EnterIcon",
  <>
    <path d="M4 12h12" />
    <path d="M11.4 6.6 17 12l-5.6 5.4" />
    <path d="M20 4v16" />
  </>,
);

export const DoorIcon = icon(
  "DoorIcon",
  <>
    <path d="M14 3.5 5.5 5.2v13.6L14 20.5Z" />
    <path d="M14 3.5h4.5v17H14" />
    <circle cx="11.4" cy="12" r=".9" />
  </>,
);

export const LeaveIcon = icon(
  "LeaveIcon",
  <>
    <path d="M14 20.5H5.5V3.5H14" />
    <path d="M18.5 12H9.8" />
    <path d="M15.6 8.4 19.2 12l-3.6 3.6" />
  </>,
);
