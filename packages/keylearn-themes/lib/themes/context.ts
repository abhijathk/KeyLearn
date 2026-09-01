import { createContext, useContext } from "react";
import { DEFAULT_ACCENT } from "./accents.ts";
import { type ThemePrefs } from "./prefs.ts";
import { COLORS, FONTS, TEXT_SIZES } from "./themes.ts";

export type ThemeValue = {
  readonly fullscreenState: boolean | null;
  readonly color: string;
  readonly font: string;
  /** How large the interface is set: see TEXT_SIZES. */
  readonly textSize: string;
  /** The accent theme worn by the learner at the keyboard. */
  readonly accent: string;
  readonly hash: number;
  readonly toggleFullscreen: () => void;
  readonly switchColor: (id: string) => void;
  readonly switchFont: (id: string) => void;
  readonly switchTextSize: (id: string) => void;
  /**
   * Sets an accent for one learner. Omitting the profile means the learner
   * currently at the keyboard, which is the common case; the account's Display
   * panel passes an id so a parent can dress a child's profile without having
   * to become them first.
   *
   * `kind` is optional but should be passed whenever the caller already knows
   * it (e.g. from a live profile list) — without it, a profile created since
   * the page loaded falls back to "adult", which silently rejects every kids
   * accent for a just-created kid profile. See accent-storage.ts's `kindOf`.
   */
  readonly switchAccent: (
    id: string,
    profileId?: string | null,
    kind?: "adult" | "kid",
  ) => void;
  readonly refresh: () => void;
};

export const ThemeContext = createContext<ThemeValue>({
  fullscreenState: null,
  color: COLORS.default.id,
  font: FONTS.default.id,
  textSize: TEXT_SIZES.default.id,
  accent: DEFAULT_ACCENT,
  hash: 0,
  toggleFullscreen: () => {},
  switchColor: () => {},
  switchFont: () => {},
  switchTextSize: () => {},
  switchAccent: () => {},
  refresh: () => {},
});

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function staticTheme(
  { color, font, textSize, accent }: ThemePrefs,
  hash: number = 0,
): ThemeValue {
  return {
    fullscreenState: null,
    color,
    font,
    textSize,
    accent,
    hash,
    toggleFullscreen: () => {},
    switchColor: () => {},
    switchFont: () => {},
    switchTextSize: () => {},
    switchAccent: () => {},
    refresh: () => {},
  };
}
