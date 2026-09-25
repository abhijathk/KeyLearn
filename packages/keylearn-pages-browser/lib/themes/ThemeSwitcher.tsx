import { useTheme } from "@keylearn/themes";
import { IconButton, StrokeIcon } from "@keylearn/widget";
import { defineMessage, useIntl } from "react-intl";
import * as styles from "./ThemeSwitcher.module.less";

// The header theme control cycles through three modes: Auto (follow the
// device's own light/dark setting, updating live with no refresh), Day, and
// Night. Auto is the default for a fresh visit.
const ORDER = ["auto", "keylearn-day", "keylearn"] as const;

// Day and Night are the words the theme maker already uses for the same two
// grounds, so the header and the maker say the same thing in every language.
const LABEL = {
  "auto": defineMessage({
    id: "header.theme.autoFollows",
    defaultMessage: "Auto — matches your device",
  }),
  "keylearn-day": defineMessage({
    id: "theme.maker.tagDay",
    defaultMessage: "Day",
  }),
  "keylearn": defineMessage({
    id: "theme.maker.tagNight",
    defaultMessage: "Night",
  }),
} as const;

const AUTO = defineMessage({
  id: "account.prefs.theme.auto",
  defaultMessage: "Auto",
});

const TITLE = defineMessage({
  id: "header.theme.title",
  defaultMessage: "Theme: {mode}. Tap to switch — {auto}, {day}, {night}.",
});

const ICON = {
  "auto": "auto",
  "keylearn-day": "sun",
  "keylearn": "moon",
} as const;

export function ThemeSwitcher() {
  const { formatMessage } = useIntl();
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
        icon={<StrokeIcon name={ICON[current]} />}
        title={formatMessage(TITLE, {
          mode: formatMessage(LABEL[current]),
          auto: formatMessage(AUTO),
          day: formatMessage(LABEL["keylearn-day"]),
          night: formatMessage(LABEL["keylearn"]),
        })}
        onClick={() => {
          switchColor(next);
        }}
      />
    </div>
  );
}
