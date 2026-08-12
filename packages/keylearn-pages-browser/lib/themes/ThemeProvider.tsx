import { Cookie, SetCookie } from "@fastr/headers";
import {
  A11Y_CHANGED_EVENT,
  activeProfileId,
  loadA11y,
  loadAccent,
  loadContrast,
  loadSafeZones,
  loadThemedZones,
  PROFILE_CHANGED_EVENT,
  saveAccent,
  ZONES_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import {
  applyContrastLevel,
  applyTheme,
  applyThemedZones,
  applyZonePalette,
  clearTheme,
  CUSTOM_PREFIX,
  findAnyAccent,
  readTheme,
  ThemeContext,
  themedZones,
  ThemePrefs,
  usePreferredColorScheme,
} from "@keylearn/themes";
import { useFullscreen } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { applyFavIcon } from "./fav-icon.ts";

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const fullscreenTarget =
    document.querySelector("[fullscreen-target]") ??
    document.querySelector("main") ??
    document.documentElement;

  const [fullscreenState, toggleFullscreen] = useFullscreen(fullscreenTarget);
  // The cookie carries the ground; the accent is a per-learner fact, so it is
  // read from that learner's slot and the cookie only mirrors it afterwards
  // (see storePrefs) to keep the server-rendered first paint honest.
  const [{ color, font }, setPrefs] = useState(() => readPrefs());
  const [accent, setAccent] = useState(() => loadAccent());
  const [hash, setHash] = useState(0);
  usePreferredColorScheme();

  useEffect(() => {
    if (color === "custom") {
      readTheme()
        .then(({ theme }) => {
          applyTheme(theme);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      clearTheme();
    }
  }, [color]);

  // A learner switch happens elsewhere in the tree and does not remount this
  // component, so the new learner's accent has to be picked up on the event.
  useEffect(() => {
    const onProfileChanged = () => {
      setAccent(loadAccent());
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    return () => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    };
  }, []);

  useEffect(() => {
    // "Auto" follows the device, so a custom accent has to know which face of
    // itself to wear right now.
    const day =
      color === "keylearn-day" ||
      (color === "auto" &&
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: light)").matches === true);
    applyAccent(accent, day);
    // After the accent, so these override the zones the theme has just set,
    // and so the derived palette can read the accent that was written.
    paintZones(day);
    // The tab follows the learner. Called after applyAccent so the custom
    // property it has just written is the colour that gets read.
    applyFavIcon();
    // The cookie exists so the server-rendered first paint already carries the
    // right accent. Only write when it would actually change: a page load that
    // rewrites an identical cookie is churn, and it would also quietly repair
    // a cookie the app is supposed to leave alone.
    if (readPrefs().accent !== accent) {
      storePrefs(new ThemePrefs({ color, font, accent }));
    }
    // The Appearance panel does not re-render this provider, so it says when
    // the preference moved and the night/day question stays answered here.
    // After the theme and the accent, because it reads the text colours they
    // have just written and lifts them from there.
    applyAdaptations();
    const onZones = () => {
      paintZones(day);
      applyAdaptations();
    };
    window.addEventListener(ZONES_CHANGED_EVENT, onZones);
    window.addEventListener(A11Y_CHANGED_EVENT, applyAdaptations);
    window.addEventListener(PROFILE_CHANGED_EVENT, applyAdaptations);
    return () => {
      window.removeEventListener(ZONES_CHANGED_EVENT, onZones);
      window.removeEventListener(A11Y_CHANGED_EVENT, applyAdaptations);
      window.removeEventListener(PROFILE_CHANGED_EVENT, applyAdaptations);
    };
  }, [accent, color, font]);

  return (
    <ThemeContext.Provider
      value={{
        fullscreenState,
        color,
        font,
        accent,
        hash,
        toggleFullscreen,
        switchColor: (id) => {
          const prefs = new ThemePrefs({ color: id, font, accent });
          switchTheme(prefs);
          setPrefs(prefs);
          setHash(hash + 1);
          storePrefs(prefs);
        },
        switchFont: (id) => {
          const prefs = new ThemePrefs({ color, font: id, accent });
          switchTheme(prefs);
          setPrefs(prefs);
          setHash(hash + 1);
          storePrefs(prefs);
        },
        switchAccent: (id, profileId) => {
          if (!saveAccent(id, profileId)) {
            return;
          }
          // Dressing another learner's profile must not repaint the screen the
          // parent is standing on: only adopt the accent when it belongs to
          // whoever is actually at the keyboard.
          if (profileId === undefined || profileId === activeProfileId()) {
            setAccent(id);
            setHash(hash + 1);
          }
        },
        refresh: () => {
          setAccent(loadAccent());
          setHash(hash + 1);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function switchTheme(prefs: ThemePrefs) {
  ((elem) => {
    elem.setAttribute(ThemePrefs.colorAttrName, prefs.color);
    elem.setAttribute(ThemePrefs.fontAttrName, prefs.font);
    elem.setAttribute(ThemePrefs.accentAttrName, prefs.accent);
  })(document.documentElement);
}

// The accent-derived properties a theme owns. Kept in step with the mixin in
// accents.less, which owns the same list for the shipped themes.
const ACCENT_PROPS = [
  "--accent-d2",
  "--accent-d1",
  "--accent",
  "--accent-l1",
  "--accent-l2",
  "--accent-ink",
  "--accent-l1-ink",
  "--accent-d1-ink",
  "--effort-color",
  "--control-color",
  "--textinput-cursor__background-color",
  "--MenuItem--selected__background-color",
  "--KeyboardKey-pointer__color",
  "--syntax-keyword",
] as const;

/**
 * Ink for text drawn on a given fill, matching the `contrast()` the shipped
 * themes use. A custom accent has no stylesheet rule to inherit it from, so
 * without this a household's own colour is the one place the readable-text
 * guarantee would not hold.
 */
function ink(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l =
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255);
  return l < 0.216 ? "#ffffff" : "#241a12";
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const move = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const parts = [move((n >> 16) & 255), move((n >> 8) & 255), move(n & 255)];
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A shipped theme is a stylesheet rule keyed on the attribute; a theme the
 * household mixed has no rule to key on, so its properties are written inline.
 * Both write exactly the same list, and neither writes the ground — which is
 * what keeps the finger colours out of reach either way.
 */
/**
 * Decide which finger zones the keyboard wears.
 *
 * Order matters and is not arbitrary: the colour-blind palette wins, because
 * whether the keyboard can be read beats how it looks. Then the theme's own
 * derived set, if asked for. Otherwise nothing is written and the stylesheet's
 * own zones stand — removing rather than restoring, so switching themes later
 * does not leave last theme's colours frozen in place.
 */
function paintZones(day: boolean) {
  if (loadSafeZones()) {
    applyZonePalette(true, day);
    return;
  }
  applyZonePalette(false, day);
  if (!loadThemedZones()) {
    applyThemedZones(null);
    return;
  }
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  applyThemedZones(themedZones(accent, day));
}

/**
 * Everything the active learner has asked the page to do differently.
 *
 * Written as attributes on the root rather than as classes, so the rules live
 * in one stylesheet the whole app already loads and no component has to know
 * that any of this exists. Removed rather than set to a default value, so a
 * learner who has asked for nothing leaves no trace in the DOM at all.
 */
function applyAdaptations() {
  const elem = document.documentElement;
  const prefs = loadA11y();
  const flags: readonly [string, string | null][] = [
    ["data-motion", prefs.motion === "reduce" ? "reduce" : null],
    ["data-typeface", prefs.typeface === "dyslexic" ? "dyslexic" : null],
    ["data-targets", prefs.targets === "large" ? "large" : null],
    // These two read inverted: the attribute marks the absence, because
    // showing the clock and the figures is the ordinary case, and ordinary
    // needs no marking.
    ["data-timers", prefs.timers ? null : "off"],
    ["data-scores", prefs.scores ? null : "off"],
    ["data-finger-marks", prefs.fingerMarks ? "on" : null],
  ];
  for (const [name, value] of flags) {
    if (value == null) {
      elem.removeAttribute(name);
    } else {
      elem.setAttribute(name, value);
    }
  }
  // The reading measures are numbers rather than states, so they go as custom
  // properties. Removed rather than set to the default, so the stylesheet's own
  // value stands and nothing is frozen at whatever was on screen once.
  const measures: readonly [string, string | null][] = [
    [
      "--read-letter-spacing",
      prefs.letterSpacing > 0 ? `${prefs.letterSpacing}em` : null,
    ],
    [
      "--read-line-height",
      prefs.lineHeight > 1.2 ? String(prefs.lineHeight) : null,
    ],
  ];
  for (const [prop, value] of measures) {
    if (value == null) {
      elem.style.removeProperty(prop);
    } else {
      elem.style.setProperty(prop, value);
    }
  }
  applyContrastLevel(loadContrast(), elem.style);
}

function applyAccent(accent: string, day: boolean) {
  const elem = document.documentElement;
  elem.setAttribute(ThemePrefs.accentAttrName, accent);
  if (!accent.startsWith(CUSTOM_PREFIX)) {
    for (const prop of ACCENT_PROPS) {
      elem.style.removeProperty(prop);
    }
    return;
  }
  const own = findAnyAccent(accent);
  if (own == null) {
    return;
  }
  const base = day ? own.day : own.night;
  const value: Record<(typeof ACCENT_PROPS)[number], string> = {
    "--accent-d2": shade(base, day ? -0.32 : -0.28),
    "--accent-d1": shade(base, day ? -0.16 : -0.14),
    "--accent": base,
    "--accent-l1": shade(base, 0.16),
    "--accent-l2": shade(base, 0.32),
    "--accent-ink": ink(base),
    "--accent-l1-ink": ink(shade(base, 0.16)),
    "--accent-d1-ink": ink(shade(base, day ? -0.16 : -0.14)),
    "--effort-color": base,
    "--control-color": base,
    "--textinput-cursor__background-color": base,
    "--MenuItem--selected__background-color": base,
    "--KeyboardKey-pointer__color": base,
    "--syntax-keyword": base,
  };
  for (const prop of ACCENT_PROPS) {
    elem.style.setProperty(prop, value[prop]);
  }
}

function readPrefs() {
  return ThemePrefs.deserialize(
    Cookie.parse(document.cookie).get(ThemePrefs.cookieKey),
  );
}

function storePrefs(prefs: ThemePrefs) {
  document.cookie = String(
    new SetCookie(ThemePrefs.cookieKey, ThemePrefs.serialize(prefs), {
      maxAge: 100 * 24 * 60 * 60,
      sameSite: "Lax",
    }),
  );
}
