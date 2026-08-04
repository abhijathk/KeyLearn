import { KeyboardOptions, Layout } from "@keylearn/keyboard";
import { Settings } from "@keylearn/settings";
import { ViewContext, type ViewName } from "@keylearn/widget";
import { useEffect, useState } from "react";
import { PracticeScreen } from "./practice/PracticeScreen.tsx";
import { SettingsScreen } from "./settings/SettingsScreen.tsx";

setDefaultLayout(window.navigator.language);

function setDefaultLayout(localeId: string) {
  const layout = Layout.findLayout(localeId);
  if (layout != null) {
    Settings.addDefaults(
      KeyboardOptions.default()
        .withLanguage(layout.language)
        .withLayout(layout)
        .save(new Settings()),
    );
  }
}

export function PracticePage() {
  // The practice screen stays mounted; settings opens as a window on top of it
  // rather than replacing the page.
  const [view, setView] = useState<ViewName>("practice");
  // The lesson stamp lives in the header, which is outside this view context,
  // so it asks for the settings screen by event rather than reaching in.
  useEffect(() => {
    const open = () => {
      setView("settings");
    };
    window.addEventListener("keylearn:practice-settings", open);
    return () => {
      window.removeEventListener("keylearn:practice-settings", open);
    };
  }, []);
  return (
    <ViewContext.Provider
      value={{
        setView: (name) => {
          setView(name);
        },
      }}
    >
      <PracticeScreen />
      {view === "settings" && <SettingsScreen />}
    </ViewContext.Provider>
  );
}
