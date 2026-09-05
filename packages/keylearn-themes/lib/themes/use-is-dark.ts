import { useEffect, useState } from "react";
import { useTheme } from "./context.ts";

/**
 * Whether the page is being painted dark *right now*.
 *
 * A different question from which theme the reader picked, and the reason
 * this exists rather than a `color === "keylearn"` check at each call site:
 * the default is "auto", which means whatever the device says this minute.
 * A reader on auto who flips their laptop to dark at sunset has changed the
 * answer without touching anything here.
 *
 * Two effects need it, in opposite directions — the pointer trail is only
 * legible on a dark ground, the artwork behind the stats only on a light one
 * — so the resolution lives in one place instead of being written twice and
 * drifting.
 *
 * `matchMedia` is a browser API rather than a DOM one and jsdom does not
 * supply it; without it there is no device preference to read, so an explicit
 * choice still decides and "auto" falls back to light. That matches the
 * stylesheet, where the dark half of auto is behind the media query.
 */
export function useIsDark(): boolean {
  const { color } = useTheme();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The two explicit themes answer for themselves; see COLORS in themes.ts
  // and theme-14-auto.less for the third.
  switch (color) {
    case "keylearn":
      return true;
    case "keylearn-day":
      return false;
    default:
      return systemDark;
  }
}
