import { Dir } from "@keybr/intl";
import { names } from "@keybr/lesson-ui";
import { IconButton, StrokeIcon, useView } from "@keybr/widget";
import { clsx } from "clsx";
import { memo, type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { views } from "../views.tsx";
import * as styles from "./Controls.module.less";

/**
 * A quiet toolbar tucked into the corner above the practice text. Only the
 * settings gear and a collapse toggle show at rest; the rest of the tools —
 * help, restart/skip, layout, and the text-size slider — fold away until the
 * toggle reveals them.
 */
export const Controls = memo(function Controls({
  onResetLesson,
  onSkipLesson,
  onHelp,
  textSize,
  onTextSize,
}: {
  readonly onChangeView?: () => void;
  readonly onResetLesson: () => void;
  readonly onSkipLesson: () => void;
  readonly onHelp: () => void;
  readonly textSize?: number;
  readonly onTextSize?: (value: number) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { setView } = useView(views);
  const [open, setOpen] = useState(false);
  return (
    <div
      id={names.controls}
      className={clsx(styles.controls, open && styles.open)}
    >
      {open && (
        <div className={styles.tools}>
          <IconButton
            icon={<StrokeIcon name="help" />}
            title={formatMessage({
              id: "practice.widget.showTour.description",
              defaultMessage:
                "Open a guided tour with helpful walkthrough slides.",
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
          {onTextSize != null && (
            <label
              className={styles.sizer}
              title={formatMessage({
                id: "practice.widget.textSize.description",
                defaultMessage: "Practice text size",
              })}
            >
              <span className={styles.sizerIcon}>Aa</span>
              <input
                type="range"
                min={0.75}
                max={1.5}
                step={0.05}
                value={textSize ?? 1}
                onChange={(ev) => {
                  onTextSize(Number(ev.target.value));
                }}
              />
            </label>
          )}
        </div>
      )}

      <span className={clsx(styles.toggle, open && styles.toggleOpen)}>
        <IconButton
          icon={<StrokeIcon name="tune" />}
          title={formatMessage({
            id: "practice.widget.tools.description",
            defaultMessage: "Show or hide the practice tools.",
          })}
          onClick={() => {
            setOpen((v) => !v);
          }}
        />
      </span>

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
