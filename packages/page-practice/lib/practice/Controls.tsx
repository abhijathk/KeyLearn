import { Dir } from "@keybr/intl";
import { names } from "@keybr/lesson-ui";
import { IconButton, StrokeIcon, useView } from "@keybr/widget";
import { memo, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { views } from "../views.tsx";
import * as styles from "./Controls.module.less";

/**
 * The quiet ghost cluster in the corner: everything the mockup keeps out of
 * sight but a user still needs — help, reset, skip, layout, settings.
 */
export const Controls = memo(function Controls({
  onChangeView,
  onResetLesson,
  onSkipLesson,
  onHelp,
}: {
  readonly onChangeView: () => void;
  readonly onResetLesson: () => void;
  readonly onSkipLesson: () => void;
  readonly onHelp: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { setView } = useView(views);
  return (
    <div id={names.controls} className={styles.controls}>
      <IconButton
        icon={<StrokeIcon name="help" />}
        title={formatMessage({
          id: "practice.widget.showTour.description",
          defaultMessage: "Open a guided tour with helpful walkthrough slides.",
        })}
        onClick={onHelp}
      />
      <Dir swap="icon">
        <IconButton
          icon={<StrokeIcon name="undo" />}
          title={formatMessage({
            id: "practice.widget.resetLesson.description",
            defaultMessage: "Restart this lesson (Ctrl + Left Arrow).",
          })}
          onClick={onResetLesson}
        />
        <IconButton
          icon={<StrokeIcon name="redo" />}
          title={formatMessage({
            id: "practice.widget.skipLesson.description",
            defaultMessage: "Move to the next lesson (Ctrl + Right Arrow).",
          })}
          onClick={onSkipLesson}
        />
      </Dir>
      <IconButton
        icon={<StrokeIcon name="grid" />}
        title={formatMessage({
          id: "practice.widget.switchView.description",
          defaultMessage: "Change the current screen layout.",
        })}
        onClick={onChangeView}
      />
      <IconButton
        icon={<StrokeIcon name="settings" />}
        title={formatMessage({
          id: "practice.widget.settings.description",
          defaultMessage:
            "Adjust lesson settings, language, keyboard layout, and more.",
        })}
        onClick={() => {
          setView("settings");
        }}
      />
    </div>
  );
});
