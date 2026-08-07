import { accentNames, useProfiles } from "@keylearn/page-account";
import { findAccent, useTheme } from "@keylearn/themes";
import { type ReactNode } from "react";
import * as styles from "./PaletteStrip.module.less";

/**
 * The colour in use, at the foot of the drawer.
 *
 * The drawer is where you switch learners, so it is also where "whose colour
 * am I looking at?" gets asked. It follows the learner chips at the top: pick
 * a different learner and this changes in the same breath the rest of the app
 * does, which makes it a confirmation the switch landed rather than
 * decoration.
 *
 * The colour fills the whole strip rather than sitting in a band beside a
 * label: at this height a band is a stripe, while a filled bar is the colour
 * itself. Shorter than a chip in the picker and not a control — a full chip
 * reads as "pick me", and a control below "Log out" would be missed.
 */
export function PaletteStrip(): ReactNode {
  const { accent } = useTheme();
  const { active } = useProfiles();

  // Signed out there is one colour and no learner to attribute it to, so the
  // strip would only be restating the obvious.
  if (active == null) {
    return null;
  }

  const { id, night } = findAccent(accent);
  const lit = shade(night, 0.22);
  return (
    <div
      className={styles.strip}
      style={{
        // The three shades that used to be separate bands, now the ground —
        // and as three blocks rather than a blend. Blended, a palette of one
        // hue reads as a single colour and the strip stops saying there are
        // three. The stops are hard for the same reason the picker's bands
        // were.
        background:
          `linear-gradient(90deg, ${lit} 0 46%, ` +
          `${night} 46% 74%, ${shade(night, -0.18)} 74% 100%)`,
        // Dark ink, which is what nearly every accent in the set wants — but
        // measured rather than assumed, because a few are dark enough that a
        // dark label would simply disappear. The name sits inside the first
        // block, so that block is what decides.
        color: ink(lit),
      }}
    >
      <span className={styles.name}>{accentNames[id]}</span>
    </div>
  );
}

/** Dark or light, whichever the ground can actually carry. */
function ink(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.42 ? "#241a12" : "#fff";
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const move = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const parts = [move((n >> 16) & 255), move((n >> 8) & 255), move(n & 255)];
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
