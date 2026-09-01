import { Backlight, keyboardProps, KeyboardStyle } from "@keylearn/keyboard";
import { type Settings } from "@keylearn/settings";
import { useSyncExternalStore } from "react";
import {
  MECHANICAL_DAY_SKIN,
  MECHANICAL_SKIN,
  MIDNIGHT_SKIN,
  ROUND_SKINS,
  SILVER_SKIN,
  type Skin,
} from "./skins.ts";

/**
 * Whether the page is on a dark theme.
 *
 * Themes are chosen in the app, not by the OS, so this reads the attribute the
 * theme switcher sets and only falls back to the media query before that
 * attribute exists.
 */
export function usingDarkTheme(): boolean {
  if (typeof document === "undefined") {
    return true; // SSR: the signature theme is the dark one.
  }
  const attr = document.documentElement.dataset.color ?? "";
  if (attr.includes("day") || attr.includes("light")) {
    return false;
  }
  // "auto" means the theme follows the OS, so the attribute answers nothing and
  // the media query does. Treating it as a named theme made the board pick its
  // night face on a light page.
  if (attr !== "" && attr !== "auto") {
    return true;
  }
  // matchMedia is a browser API, not a DOM one — jsdom has a document but no
  // matchMedia, so a component that renders this under test crashed the whole
  // tree. Absent the API there is no OS preference to read, and the signature
  // theme is the dark one.
  if (typeof window.matchMedia !== "function") {
    return true;
  }
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

/**
 * Whether the backlight is on.
 *
 * Two layers need this answer — the glow under the keys, and the pointer layer
 * deciding whether to draw a ring at all — and they must never disagree. Two
 * copies of a rule this small is how a board ends up wearing both cues at once.
 */
export function backlightOn(
  settings: Settings,
  dark = usingDarkTheme(),
): boolean {
  const style = settings.get(keyboardProps.style);
  if (!style.lightable) {
    return false;
  }
  switch (settings.get(keyboardProps.backlight)) {
    case Backlight.On:
      return true;
    case Backlight.Off:
      return false;
    default:
      return dark;
  }
}

/**
 * Whether the next key is shown as light rather than as a ring.
 *
 * A mechanical board always lights its next key, even with the backlight off:
 * that is what a reactive board does, and it is the only lit thing on an
 * otherwise dark board, so it reads clearly in a bright room. The flat board
 * only does it while its backlight is on; with the light off it keeps the ring.
 */
export function cueIsLight(
  settings: Settings,
  dark = usingDarkTheme(),
): boolean {
  const style = settings.get(keyboardProps.style);
  return style === KeyboardStyle.MECHANICAL || backlightOn(settings, dark);
}

/**
 * Which keyset draws the caps, or null for KeyLearn's own board.
 *
 * Silver and Midnight Grey are two listed styles, so neither consults the
 * theme: whichever board was chosen is the board that is drawn, on a light
 * page or a dark one. Only Mechanical still has a face per theme, and that is
 * one keyset in two lightings rather than two keysets.
 */
export function skinFor(
  settings: Settings,
  dark = usingDarkTheme(),
): Skin | null {
  switch (settings.get(keyboardProps.style)) {
    case KeyboardStyle.MECHANICAL:
      return dark ? MECHANICAL_SKIN : MECHANICAL_DAY_SKIN;
    case KeyboardStyle.FLAT_SILVER:
      return SILVER_SKIN;
    case KeyboardStyle.FLAT_MIDNIGHT:
      return MIDNIGHT_SKIN;
    // The round board has ONE face per colour, worn on both themes: the theme
    // changes the light, not the plastic. So `dark` does not appear here.
    case KeyboardStyle.ROUND:
      return (
        ROUND_SKINS[settings.get(keyboardProps.colour).id] ??
        ROUND_SKINS.graphite
      );
    default:
      return null;
  }
}

/**
 * The theme, as a value React re-renders on.
 *
 * `usingDarkTheme` reads a DOM attribute, and nothing tells React when that
 * attribute changes — so the board kept its old face until something else
 * happened to re-render it, which is why switching theme appeared to take
 * seconds. A MutationObserver on the one attribute makes the swap immediate.
 */
function subscribeToTheme(onChange: () => void): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-color"],
  });
  // On "auto" the attribute never changes, so the OS preference is the signal.
  // Guarded for the same reason as above: no matchMedia, no signal to watch.
  if (typeof window.matchMedia !== "function") {
    return () => {
      observer.disconnect();
    };
  }
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function useDarkTheme(): boolean {
  return useSyncExternalStore(
    subscribeToTheme,
    usingDarkTheme,
    () => true, // SSR: the signature theme is the dark one.
  );
}

/** {@link skinFor}, re-evaluated the moment the theme changes. */
export function useSkin(settings: Settings): Skin | null {
  const dark = useDarkTheme();
  return skinFor(settings, dark);
}

/** {@link backlightOn}, re-evaluated the moment the theme changes. */
export function useBacklightOn(settings: Settings): boolean {
  const dark = useDarkTheme();
  return backlightOn(settings, dark);
}

/** {@link cueIsLight}, re-evaluated the moment the theme changes. */
export function useCueIsLight(settings: Settings): boolean {
  const dark = useDarkTheme();
  return cueIsLight(settings, dark);
}

/**
 * The corner radius a cap wears on the board currently chosen.
 *
 * Every layer that outlines a key — the wrong-key flash, the next-key ring,
 * the cue glow — used a hardcoded 7, which is a rounded square. On the round
 * board a cap is a circle at 1u and a stadium when wider, so the radius is
 * half the HEIGHT whatever the width, and an outline that assumes otherwise
 * sits visibly outside the cap at the ends. One place answers it so the
 * layers cannot drift apart.
 */
export function useCapRadius(settings: Settings): (h: number) => number {
  const round = useSkin(settings)?.geom.round === true;
  return (h: number) => (round ? h / 2 : 7);
}
