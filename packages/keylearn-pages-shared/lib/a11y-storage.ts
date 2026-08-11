import { activeProfileId, profileStorageKeyFor } from "./profile-storage.ts";

const A11Y_KEY = "keylearn.a11y";

/** Said whenever any of these move, so the provider can repaint the page. */
export const A11Y_CHANGED_EVENT = "keylearn:a11y";

/**
 * The accessibility settings that are one learner's own.
 *
 * Per learner rather than per account, like every other setting that changes
 * what the app does: a household shares one login, and the person who needs
 * larger targets is not necessarily the one who set the account up.
 *
 * Every default is the app as it ships. Nobody is opted into an adaptation
 * they did not ask for, and a learner who never opens this page sees exactly
 * what they saw before it existed.
 */
export type A11yPrefs = {
  /**
   * Whether to still animations regardless of what the system says.
   *
   * The OS switch is the right default and the app already honours it, but it
   * is all-or-nothing across every app on the machine — somebody who wants
   * films to move and this page to hold still has no way to say so there.
   */
  readonly motion: "system" | "reduce";
  /**
   * A typeface built for readers who find letters swapping places.
   *
   * OpenDyslexic, which is already in the app for the theme that uses it:
   * weighted bottoms and distinct letterforms so b/d/p/q cannot rotate into
   * one another.
   */
  readonly typeface: "default" | "dyslexic";
  /**
   * Bigger targets for everything you click.
   *
   * WCAG 2.2 asks for 24×24 CSS pixels at AA and 44×44 at AAA. The app meets
   * the first; this asks for the second, which is what a learner with a tremor
   * or a touchscreen actually needs.
   */
  readonly targets: "default" | "large";
  /**
   * Say in sound what the page says in colour.
   *
   * A wrong keystroke is currently red, and red is exactly what a learner with
   * a colour vision difference may not see. This turns on the error tone so
   * the same fact arrives by ear.
   */
  readonly cues: boolean;
  /**
   * Whether anything counts down.
   *
   * A timer running while you type is pressure, and pressure is not a
   * teaching aid for everybody — for an anxious learner it is the reason they
   * stop. The practice itself is unchanged; only the clock goes.
   */
  readonly timers: boolean;
  /**
   * How fast the braille voice reads, as a multiplier.
   *
   * Kept here rather than with the braille page's own settings because a
   * parent setting a child up should not have to sit through the braille page
   * to find it — and because both places have to agree, which two copies of a
   * number never do for long.
   */
  readonly speechRate: number;
  /**
   * A named system voice, or null for whichever one matches the page's
   * language. Only ever set by the learner choosing from the list — picking
   * one for them is how you end up reading a lesson in a novelty voice.
   */
  readonly speechVoice: string | null;
};

export const defaultA11y: A11yPrefs = {
  motion: "system",
  typeface: "default",
  targets: "default",
  cues: false,
  timers: true,
  speechRate: 1,
  speechVoice: null,
};

function clampRate(value: unknown): number {
  const rate = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(3, Math.max(0.5, rate));
}

/** One learner's settings, defaulted field by field so a partial read is safe. */
export function loadA11y(profileId?: string | null): A11yPrefs {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const raw = localStorage.getItem(profileStorageKeyFor(id, A11Y_KEY));
    if (raw == null) {
      return defaultA11y;
    }
    const json = JSON.parse(raw) ?? {};
    return {
      motion: json.motion === "reduce" ? "reduce" : "system",
      typeface: json.typeface === "dyslexic" ? "dyslexic" : "default",
      targets: json.targets === "large" ? "large" : "default",
      cues: json.cues === true,
      timers: json.timers !== false,
      speechRate: clampRate(json.speechRate),
      speechVoice:
        typeof json.speechVoice === "string" && json.speechVoice !== ""
          ? json.speechVoice
          : null,
    };
  } catch {
    return defaultA11y;
  }
}

/**
 * Change some of them, leaving the rest alone.
 *
 * A patch rather than a whole object because these are set one switch at a
 * time, and a caller holding a stale copy would otherwise undo whatever was
 * changed on another pane in the meantime.
 */
export function saveA11y(
  patch: Partial<A11yPrefs>,
  profileId?: string | null,
): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const next = { ...loadA11y(id), ...patch };
    localStorage.setItem(
      profileStorageKeyFor(id, A11Y_KEY),
      JSON.stringify(next),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this learner has a record at all.
 *
 * Asked by anything carrying an older setting across: "has never answered" and
 * "answered with the default" look identical in the values, and only the first
 * one may be overwritten.
 */
export function hasA11y(profileId?: string | null): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    return localStorage.getItem(profileStorageKeyFor(id, A11Y_KEY)) != null;
  } catch {
    return false;
  }
}

/** Whether this learner has changed any of them from how the app ships. */
export function a11yAdapted(profileId?: string | null): boolean {
  const prefs = loadA11y(profileId);
  return (
    prefs.motion !== "system" ||
    prefs.typeface !== "default" ||
    prefs.targets !== "default" ||
    prefs.cues ||
    !prefs.timers
  );
}
