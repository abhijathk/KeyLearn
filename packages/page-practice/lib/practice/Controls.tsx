import { Dir } from "@keylearn/intl";
import { names } from "@keylearn/lesson-ui";
import { uiProps } from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import {
  IconButton,
  type IconButtonRef,
  StrokeIcon,
  useView,
} from "@keylearn/widget";
import { clsx } from "clsx";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { defineMessages, useIntl } from "react-intl";

// Hoisted so formatjs can extract them; a message built inside a ternary is
// invisible to static extraction and never reaches the catalogue.
const KEYBOARD = defineMessages({
  show: {
    id: "practice.widget.showKeyboard.description",
    defaultMessage: "Show the on-screen keyboard.",
  },
  hide: {
    id: "practice.widget.hideKeyboard.description",
    defaultMessage:
      "Hide the on-screen keyboard — practise typing without looking down.",
  },
});
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
  const { settings, updateSettings } = useSettings();
  const { setView } = useView(views);
  const [open, setOpen] = useState(false);
  const keyboardHidden = settings.get(uiProps.hideKeyboard);
  // Picking a tool folds the menu back up; the text-size slider is the one
  // exception — it stays open so you can keep dragging.
  const pick = (run: () => void) => () => {
    run();
    setOpen(false);
  };
  // The menu tidies itself away: it auto-closes a few seconds after you stop
  // touching it, and the moment you start typing — the one exception being the
  // text-size slider, which keeps it open while you drag.
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const usingSlider = useRef(false);
  const toggleRef = useRef<IconButtonRef>(null);
  const scheduleClose = useCallback((ms = 4000) => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (!usingSlider.current) {
        setOpen(false);
      }
    }, ms);
  }, []);
  useEffect(() => {
    if (!open) {
      clearTimeout(closeTimer.current);
      return;
    }
    scheduleClose();
    const onKeyDown = (ev: KeyboardEvent) => {
      // Typing a character folds the menu away at once (unless the slider is
      // being dragged with the keyboard).
      if (!usingSlider.current && ev.key.length === 1) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(closeTimer.current);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, scheduleClose]);
  const sliderGrab = () => {
    usingSlider.current = true;
    clearTimeout(closeTimer.current);
  };
  const sliderRelease = () => {
    usingSlider.current = false;
    scheduleClose();
  };
  return (
    <div
      id={names.controls}
      className={clsx(styles.controls, open && styles.open)}
    >
      {open && (
        <div
          className={styles.tools}
          onPointerDown={() => scheduleClose()}
          onPointerMove={() => scheduleClose()}
        >
          <IconButton
            icon={<StrokeIcon name="help" />}
            title={formatMessage({
              id: "practice.widget.showTour.description",
              defaultMessage:
                "Open a guided tour with helpful walkthrough slides.",
            })}
            onClick={pick(onHelp)}
          />
          <Dir swap="icon">
            <IconButton
              icon={<StrokeIcon name="restart" />}
              title={formatMessage({
                id: "practice.widget.resetLesson.description",
                defaultMessage: "Restart this lesson (Ctrl + Left Arrow).",
              })}
              onClick={pick(onResetLesson)}
            />
            <IconButton
              icon={<StrokeIcon name="skip" />}
              title={formatMessage({
                id: "practice.widget.skipLesson.description",
                defaultMessage: "Move to the next lesson (Ctrl + Right Arrow).",
              })}
              onClick={pick(onSkipLesson)}
            />
          </Dir>
          <IconButton
            icon={
              <StrokeIcon name={keyboardHidden ? "keyboardOff" : "keyboard"} />
            }
            title={formatMessage(
              keyboardHidden ? KEYBOARD.show : KEYBOARD.hide,
            )}
            onClick={pick(() => {
              updateSettings(
                settings.set(uiProps.hideKeyboard, !keyboardHidden),
              );
            })}
          />
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
                onPointerDown={sliderGrab}
                onPointerUp={sliderRelease}
                onFocus={sliderGrab}
                onBlur={sliderRelease}
                onChange={(ev) => {
                  onTextSize(Number(ev.target.value));
                  scheduleClose();
                }}
              />
            </label>
          )}
        </div>
      )}

      <span className={clsx(styles.toggle, open && styles.toggleOpen)}>
        <IconButton
          ref={toggleRef}
          icon={<StrokeIcon name="tune" />}
          title={formatMessage({
            id: "practice.widget.tools.description",
            defaultMessage: "Show or hide the practice tools.",
          })}
          onClick={(ev) => {
            setOpen((v) => !v);
            // Enter on this screen starts the lesson. A button that keeps
            // focus after the menu has folded away answers it first and opens
            // the menu again instead. Keyboard activation (detail 0) keeps its
            // place in the tab order; a mouse click has no use for it.
            if (ev.detail > 0) {
              toggleRef.current?.blur();
            }
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
