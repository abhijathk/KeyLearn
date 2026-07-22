import { useTheme } from "@keybr/themes";
import { IconButton, StrokeIcon } from "@keybr/widget";
import { defineMessage, useIntl } from "react-intl";
import * as styles from "./ThemeSwitcher.module.less";

/** The single theme control in the header: toggles between night and day. */
export function ThemeSwitcher() {
  const { formatMessage } = useIntl();
  const { color, switchColor } = useTheme();
  const night = color !== "keylearn-day";
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
        icon={<StrokeIcon name="theme" />}
        title={formatMessage(
          defineMessage({
            id: "theme.switchTheme.description",
            defaultMessage: "Toggle light and dark mode.",
          }),
        )}
        onClick={() => {
          switchColor(night ? "keylearn-day" : "keylearn");
        }}
      />
    </div>
  );
}
