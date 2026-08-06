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
 * Deliberately about two thirds the height of a chip in the picker, and not a
 * control. A full chip reads as "pick me", and a control below "Log out" would
 * be missed; this reads as "here is what you have".
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
  return (
    <div className={styles.strip}>
      <span className={styles.text}>
        <span className={styles.name}>{accentNames[id]}</span>
        <span className={styles.learner}>{active.firstName}</span>
      </span>
      <span className={styles.bands} aria-hidden={true}>
        <i style={{ backgroundColor: night }} />
        <i style={{ backgroundColor: shade(night, -0.18) }} />
        <i style={{ backgroundColor: shade(night, 0.22) }} />
      </span>
    </div>
  );
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const move = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const parts = [move((n >> 16) & 255), move((n >> 8) & 255), move(n & 255)];
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
