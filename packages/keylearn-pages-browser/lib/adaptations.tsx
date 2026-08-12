import {
  A11Y_CHANGED_EVENT,
  loadA11y,
  PROFILE_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import { SettingsContext, useSettings } from "@keylearn/settings";
import { Font, textDisplayProps } from "@keylearn/textinput";
import { PlaySounds, soundProps } from "@keylearn/textinput-sounds";
import { type ReactNode, useEffect, useMemo, useState } from "react";

/** The practice font for a learner who has asked for one built for dyslexia. */
const DYSLEXIC = "Open Dyslexic";

/**
 * The learner's accessibility settings, applied to a typing surface.
 *
 * The ones that are a matter of colour or size are attributes on the root and
 * need nothing from any component. These two are not: the sounds and the
 * practice font are settings the typing surface reads, so they have to be
 * changed in the settings it is given rather than in a stylesheet.
 *
 * Wrapped around the surface rather than written into the learner's own
 * settings, because these are two different things: what the learner asked the
 * app to do for them, and what is in the settings menu they can see. Writing
 * one into the other would mean an accessibility switch silently editing a
 * menu, and a learner who turned it off later would not get their own choices
 * back.
 */
export function WithAdaptations({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { settings, updateSettings } = useSettings();
  const [prefs, setPrefs] = useState(() => loadA11y());
  useEffect(() => {
    const reread = () => setPrefs(loadA11y());
    window.addEventListener(A11Y_CHANGED_EVENT, reread);
    window.addEventListener(PROFILE_CHANGED_EVENT, reread);
    return () => {
      window.removeEventListener(A11Y_CHANGED_EVENT, reread);
      window.removeEventListener(PROFILE_CHANGED_EVENT, reread);
    };
  }, []);
  const value = useMemo(() => {
    let next = settings;
    // Only ever raises silence to errors-only. Somebody who has chosen to hear
    // every key keeps it.
    if (prefs.cues && next.get(soundProps.playSounds) === PlaySounds.None) {
      next = next.set(soundProps.playSounds, PlaySounds.ErrorsOnly);
    }
    // The interface changes by stylesheet; the text being typed does not,
    // because it carries its font inline from the one chosen in settings. That
    // is the text this setting is for — the letters somebody is reading one at
    // a time under time pressure — so it has to be changed here or the setting
    // does half of what it says.
    if (prefs.typeface === "dyslexic") {
      const font = Font.ALL.find((each) => each.name === DYSLEXIC);
      // Absent for a script it does not cover, and then the theme's font
      // stands: an alphabet somebody cannot read at all is worse than one
      // whose letters can rotate.
      if (font != null) {
        next = next.set(textDisplayProps.font, font);
      }
    }
    return next;
  }, [settings, prefs.cues, prefs.typeface]);
  return (
    <SettingsContext.Provider value={{ settings: value, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
