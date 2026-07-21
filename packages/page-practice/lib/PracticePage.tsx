import { KeyboardOptions, Layout } from "@keybr/keyboard";
import { Settings } from "@keybr/settings";
import { ViewContext, type ViewName } from "@keybr/widget";
import { useState } from "react";
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
