import { Cookie, SetCookie } from "@fastr/headers";
import {
  activeProfileId,
  loadAccent,
  PROFILE_CHANGED_EVENT,
  saveAccent,
} from "@keylearn/pages-shared";
import {
  applyTheme,
  clearTheme,
  CUSTOM_PREFIX,
  findAnyAccent,
  readTheme,
  ThemeContext,
  ThemePrefs,
  usePreferredColorScheme,
} from "@keylearn/themes";
import { useFullscreen } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";

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
    // The cookie exists so the server-rendered first paint already carries the
    // right accent. Only write when it would actually change: a page load that
    // rewrites an identical cookie is churn, and it would also quietly repair
    // a cookie the app is supposed to leave alone.
    if (readPrefs().accent !== accent) {
      storePrefs(new ThemePrefs({ color, font, accent }));
    }
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
  "--effort-color",
  "--control-color",
  "--textinput-cursor__background-color",
  "--MenuItem--selected__background-color",
  "--KeyboardKey-pointer__color",
  "--syntax-keyword",
] as const;

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
