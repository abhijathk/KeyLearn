import { TypingSettings } from "@keylearn/textinput-ui";
import { StrokeIcon, type StrokeIconName, useView } from "@keylearn/widget";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { views } from "../views.tsx";
import * as styles from "./settings.module.less";
import { TestModeSettings } from "./settings/TestModeSettings.tsx";
import { TextGeneratorSettings } from "./settings/TextGeneratorSettings.tsx";

export function SettingsScreen() {
  const { formatMessage } = useIntl();
  const { setView } = useView(views);
  const [tabIndex, setTabIndex] = useState(0);
  const close = () => {
    setView("test");
  };
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setView("test");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setView]);
  // A rail rather than tabs, so this panel, Practice settings and the account
  // all navigate the same way.
  const sections: { label: string; icon: StrokeIconName }[] = [
    {
      label: formatMessage({
        id: "typingTest.settings.testTab",
        defaultMessage: "The test",
      }),
      icon: "gauge",
    },
    {
      label: formatMessage({ id: "t_Text", defaultMessage: "Text" }),
      icon: "font",
    },
    {
      label: formatMessage({
        id: "typingTest.settings.typingTab",
        defaultMessage: "Typing",
      }),
      icon: "keyboard",
    },
  ];
  return (
    <div className={styles.overlay}>
      <div
        className={styles.window}
        role="dialog"
        aria-modal={true}
        aria-label={formatMessage({
          id: "typingTest.settings.title",
          defaultMessage: "Speed test settings",
        })}
      >
        <div className={styles.rail}>
          <div className={styles.railTitle}>
            <FormattedMessage
              id="typingTest.settings.title"
              defaultMessage="Speed test settings"
            />
          </div>
          {sections.map(({ label, icon }, index) => (
            <button
              key={label}
              type="button"
              className={clsx(
                styles.railItem,
                tabIndex === index && styles.railItemActive,
              )}
              onClick={() => {
                setTabIndex(index);
              }}
            >
              <StrokeIcon className={styles.railIcon} name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.main}>
          <div className={styles.head}>
            <span className={styles.filler} />
            <button
              type="button"
              className={styles.close}
              title={formatMessage({
                id: "t_Close",
                defaultMessage: "Dismiss",
              })}
              onClick={close}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.body}>
            {tabIndex === 0 && <TestModeSettings />}
            {tabIndex === 1 && <TextGeneratorSettings />}
            {tabIndex === 2 && <TypingSettings />}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.save} onClick={close}>
              <FormattedMessage id="t_Done" defaultMessage="Save & Close" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
