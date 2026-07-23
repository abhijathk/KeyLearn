// Hand-drawn icon set for the kids game — no emoji, no icon fonts.

type IconProps = {
  readonly size?: number;
  readonly color?: string;
};

export function DinoIcon({ size = 19, color = "#2d8cff" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 9c1.5 0 2.5 1 3 2-1 .5-2 .7-3 .5l-2 3.5v4h-2l-.5-3h-4L11 20H9l.5-4C6 15 4 13 4 10c0-1 .3-2 1-3l-2-3c2-.5 4 0 5 1.5C10 4 13 4 15.5 5.5 18 7 19 8 20 9z" />
      <circle cx="18.4" cy="9.4" r=".9" fill={color} stroke="none" />
    </svg>
  );
}

export function DinoFill({ size = 34, color = "#3d6b2e" }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" width={size} height={size * 0.7} fill={color}>
      <path d="M40 10c3 0 5 2 6 4-2 1-4 1.4-6 1l-4 7v8h-4l-1-6h-8l-1 6h-4l1-8c-7-2-11-6-11-12 0-2 .6-4 2-6l-4-6c4-1 8 0 10 3 4-3 10-3 15 0 5 3 7 6 9 9z" />
    </svg>
  );
}

export function StarIcon({ size = 15, color = "#fff" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 2.5l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2-5.6-3.3-5.6 3.3 1.4-6.2L3 8.9l6.4-.6z" />
    </svg>
  );
}

export function FlameIcon({ size = 15, color = "#fff" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 2c1 3-1 5-2.5 6.7C8 10.4 7 12 7 14a5 5 0 0 0 10 0c0-1.4-.4-2.7-1.1-3.8-.9 1.1-2 1.4-2.9.9.9-2.4.1-5.6-1-9.1z" />
    </svg>
  );
}

export function SproutIcon({ size = 15, color = "#fff" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <path d="M12 20v-7M12 13C12 8.5 8.5 6.5 5 6.5c0 4.5 3.5 6.5 7 6.5zM12 11.5c0-3.5 3-5.5 7-5.5 0 3.5-3 6-7 6z" />
    </svg>
  );
}

export function TrophyIcon({ size = 15, color = "#fff" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h10v4a5 5 0 0 1-10 0zM7 5H4.5a3 3 0 0 0 3 4.5M17 5h2.5a3 3 0 0 1-3 4.5M12 13v3m-3.5 4h7l-.8-4h-5.4z" />
    </svg>
  );
}

export function GearIcon({ size = 18, color = "#5a7ba6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M19.4 13c.04-.33.06-.66.06-1s-.02-.67-.06-1l2.1-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64L4.55 11c-.04.33-.06.66-.06 1s.02.67.06 1l-2.1 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64L19.4 13zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
    </svg>
  );
}

export function SunIcon({ size = 17, color = "#5f9a80" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  );
}

export function MoonIcon({ size = 17, color = "#5f9a80" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
    </svg>
  );
}

export function SoundIcon({
  size = 17,
  color = "#a08a52",
  muted = false,
}: IconProps & { readonly muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {muted ? (
        <path d="M4 9v6h4l5 4V5L8 9zM16 9l6 6M22 9l-6 6" />
      ) : (
        <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
      )}
    </svg>
  );
}

export function HandIcon({ size = 20, color = "#8a3a4a" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M7 4v9M11 3v10M15 4v9M19 7v6a7 7 0 0 1-14 0" />
    </svg>
  );
}

export function KeysIcon({ size = 20, color = "#1f6a4e" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <rect x="3" y="7" width="18" height="11" rx="2.5" />
      <path d="M6.5 11h0M10 11h0M13.5 11h0M17 11h0M8 14.5h8" />
    </svg>
  );
}

export function ClockIcon({ size = 20, color = "#3d6b2e" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2M9.5 2.5h5" />
    </svg>
  );
}

export function ChatIcon({ size = 20, color = "#8a3a4a" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 1 0-3.5 6.6L21 19z" />
      <path d="M8.5 10.5h0M12 10.5h0M15.5 10.5h0" />
    </svg>
  );
}

export function TentIcon({ size = 34, color = "#5c4500" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 20L12 5l9 15zM12 12l3.5 8M12 12l-3.5 8" />
      <path d="M10 20c0-2 .9-3 2-4 1.1 1 2 2 2 4" />
    </svg>
  );
}

export function BranchIcon({ size = 22, color = "#fff" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21v-8" />
      <path d="M12 13C12 8 8 6 4 6c0 5 4 7 8 7zM12 11c0-4 3.5-6 8-6 0 4-3.5 7-8 7z" />
    </svg>
  );
}

export function EggIcon({ size = 22, color = "#8a7a5c" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3c3.6 0 6.5 5 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8 8.4 3 12 3z" />
      <path d="M9 12l1.6 1.6L12 12l1.4 1.6L15 12" />
    </svg>
  );
}

export function FlagIcon({ size = 16, color = "#ff5c5c" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <path d="M6 21V4" fill="none" />
      <path d="M6 4l10 3.5L6 11z" />
    </svg>
  );
}
