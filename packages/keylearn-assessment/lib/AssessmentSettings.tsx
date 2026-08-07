import { keyboardProps } from "@keylearn/keyboard";
import { uiProps } from "@keylearn/result";
import { SettingsContext, useSettings } from "@keylearn/settings";
import { type ReactNode, useMemo } from "react";
import { useAssessment } from "./session.tsx";

/**
 * The hints, off, for as long as the sitting lasts.
 *
 * Derived and re-provided rather than written to the learner's stored
 * settings: nothing here survives the page, so nobody comes back to practice
 * the next day to find their keyboard picture gone. It also means the toggle
 * in the practice controls has nothing to toggle — the value it would write is
 * overridden on the way down.
 *
 * This is the one moment the app can tell touch typing from fast hunting. For
 * the youngest children it stays on: their certificate is about finishing the
 * trail rather than about technique, and taking the picture away from a
 * six-year-old tests their nerve rather than their typing.
 */
export function AssessmentSettings({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const session = useAssessment();
  const { settings, updateSettings } = useSettings();
  const hide = session?.plan.hideKeyboard ?? false;

  const value = useMemo(
    () => ({
      settings: hide
        ? settings
            .set(uiProps.hideKeyboard, true)
            .set(keyboardProps.pointers, false)
        : settings,
      updateSettings,
    }),
    [settings, updateSettings, hide],
  );

  if (session == null) {
    return children;
  }
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
