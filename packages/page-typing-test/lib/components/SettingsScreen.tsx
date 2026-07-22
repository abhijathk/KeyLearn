import { TypingSettings } from "@keybr/textinput-ui";
import { ExplainerBoundary, useView } from "@keybr/widget";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { views } from "../views.tsx";
import * as styles from "./settings.module.less";
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
  const tabs = [
    formatMessage({ id: "t_Text", defaultMessage: "Text" }),
    formatMessage({
      id: "typingTest.settings.typingTab",
      defaultMessage: "Typing",
    }),
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
        <div className={styles.head}>
          <span className={styles.title}>
            <FormattedMessage
              id="typingTest.settings.title"
              defaultMessage="Speed test settings"
            />
          </span>
          <span className={styles.filler} />
          <span className={styles.seg}>
            {tabs.map((label, index) => (
              <button
                key={label}
                type="button"
                className={clsx(
                  styles.segItem,
                  tabIndex === index && styles.segOn,
                )}
                onClick={() => {
                  setTabIndex(index);
                }}
              >
                {label}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={styles.close}
            title={formatMessage({ id: "t_Close", defaultMessage: "Dismiss" })}
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
          <ExplainerBoundary defaultVisible={false}>
            {tabIndex === 0 && <TextGeneratorSettings />}
            {tabIndex === 1 && <TypingSettings />}
          </ExplainerBoundary>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.save} onClick={close}>
            <FormattedMessage id="t_Done" defaultMessage="Save & Close" />
          </button>
        </div>
      </div>
    </div>
  );
}
