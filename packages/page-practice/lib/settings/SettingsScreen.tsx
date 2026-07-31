import { KeyboardProvider } from "@keybr/keyboard";
import { SettingsContext, useSettings } from "@keybr/settings";
import { TypingSettings } from "@keybr/textinput-ui";
import { StrokeIcon, type StrokeIconName, useView } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { views } from "../views.tsx";
import { KeyboardSettings } from "./KeyboardSettings.tsx";
import { LessonSettings } from "./LessonSettings.tsx";
import { MiscSettings } from "./MiscSettings.tsx";
import * as styles from "./SettingsScreen.module.less";
import { SmartPracticeSettings } from "./SmartPracticeSettings.tsx";

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { setView } = useView(views);
  const [newSettings, updateNewSettings] = useState(settings);
  return (
    <SettingsContext.Provider
      value={{
        settings: newSettings,
        updateSettings: updateNewSettings,
      }}
    >
      <KeyboardProvider>
        <SettingsWindow
          onCancel={() => {
            setView("practice");
          }}
          onSubmit={() => {
            updateSettings(newSettings);
            setView("practice");
          }}
        />
      </KeyboardProvider>
    </SettingsContext.Provider>
  );
}

type SectionId = "practice" | "smart" | "typing" | "keyboard" | "general";

const sections: {
  readonly id: SectionId;
  readonly icon: StrokeIconName;
  readonly label: ReactNode;
}[] = [
  {
    id: "practice",
    icon: "keyboard",
    label: (
      <FormattedMessage id="t_Lessons" defaultMessage="Practice Content" />
    ),
  },
  {
    id: "smart",
    icon: "gauge",
    label: (
      <FormattedMessage id="t_Smart_practice" defaultMessage="Smart Practice" />
    ),
  },
  {
    id: "typing",
    icon: "font",
    label: <FormattedMessage id="t_Typing" defaultMessage="Text Input" />,
  },
  {
    id: "keyboard",
    icon: "grid",
    label: <FormattedMessage id="t_Keyboard" defaultMessage="Keyboard Setup" />,
  },
  {
    id: "general",
    icon: "theme",
    label: <FormattedMessage id="t_Miscellaneous" defaultMessage="Display" />,
  },
];

function SettingsWindow({
  onCancel,
  onSubmit,
}: {
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const [section, setSection] = useState<SectionId>("practice");
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);
  return (
    <div className={styles.overlay}>
      <div
        className={styles.window}
        role="dialog"
        aria-modal={true}
        aria-label={formatMessage({
          id: "t_Settings",
          defaultMessage: "Settings",
        })}
      >
        <div className={styles.rail}>
          <div className={styles.railTitle}>
            <FormattedMessage id="t_Settings" defaultMessage="Settings" />
          </div>
          {sections.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              className={clsx(
                styles.railItem,
                section === id && styles.railItemActive,
              )}
              onClick={() => {
                setSection(id);
              }}
            >
              <StrokeIcon className={styles.railIcon} name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <button
              type="button"
              className={styles.close}
              title={formatMessage({
                id: "t_Close",
                defaultMessage: "Dismiss",
              })}
              onClick={onCancel}
            >
              <StrokeIcon name="close" />
            </button>
          </div>
          <div className={styles.mainBody}>
            {section === "practice" && <LessonSettings />}
            {section === "smart" && <SmartPracticeSettings />}
            {section === "typing" && <TypingSettings />}
            {section === "keyboard" && <KeyboardSettings />}
            {section === "general" && <MiscSettings />}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => {
                updateSettings(settings.reset());
              }}
            >
              <FormattedMessage
                id="t_Reset"
                defaultMessage="Restore Defaults"
              />
            </button>
            <span className={styles.filler} />
            <button type="button" className={styles.quiet} onClick={onCancel}>
              <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
            </button>
            <button type="button" className={styles.save} onClick={onSubmit}>
              <FormattedMessage id="t_Done" defaultMessage="Save & Close" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
