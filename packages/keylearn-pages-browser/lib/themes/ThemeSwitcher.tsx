import { useTheme } from "@keylearn/themes";
import { ColorIcon, IconButton } from "@keylearn/widget";
import * as styles from "./ThemeSwitcher.module.less";

// The header theme control cycles through three modes: Auto (follow the
// device's own light/dark setting, updating live with no refresh), Day, and
// Night. Auto is the default for a fresh visit.
const ORDER = ["auto", "keylearn-day", "keylearn"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  "auto": "Auto — matches your device",
  "keylearn-day": "Day",
  "keylearn": "Night",
};

const ICON = {
  "auto": "auto",
  "keylearn-day": "sun",
  "keylearn": "moon",
} as const;

export function ThemeSwitcher() {
  const { color, switchColor } = useTheme();
  const current = (ORDER as readonly string[]).includes(color)
    ? (color as (typeof ORDER)[number])
    : "keylearn";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  return (
    <div
      className={styles.root}
      onMouseDown={(ev) => {
        // Keep the focus where it is: stealing it from the practice text
        // area would blur it and reset the lesson in progress.
        ev.preventDefault();
      }}
    >
      <IconButton
        icon={<ColorIcon name={ICON[current]} />}
        title={`Theme: ${LABEL[current]}. Tap to switch — Auto, Day, Night.`}
        onClick={() => {
          switchColor(next);
        }}
      />
    </div>
  );
}
