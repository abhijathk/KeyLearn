// Where a learner's accent lives.
//
// One theme per learner, kept under the same per-profile namespace every other
// per-learner preference uses (`profile-p123.keylearn.accent`). A signed-in
// account with no learner selected gets the bare key, which is how
// profileStorageKey already behaves everywhere else — so this is one code path
// rather than two.
//
// Signed-out visitors always get the signature mint. That is the incentive to
// sign in, and it also means a shared machine cannot leak one household's
// choices to the next person at the keyboard.

import {
  accentAllowedFor,
  CUSTOM_PREFIX,
  DEFAULT_ACCENT,
  defaultAccentFor,
  findAccent,
  loadCustomAccents,
} from "@keylearn/themes";
import { getPageData } from "./pagedata.tsx";
import {
  activeProfileId,
  activeProfileKind,
  profileStorageKeyFor,
} from "./profile-storage.ts";

const KEY = "keylearn.accent";

/** Whether this visitor may wear an accent other than the default. */
export function canChooseAccent(): boolean {
  try {
    return getPageData()?.publicUser?.id != null;
  } catch {
    return false;
  }
}

/** The kind of a named profile, or the active one when no id is given. */
function kindOf(profileId: string | null | undefined): "adult" | "kid" {
  if (profileId === undefined) {
    return activeProfileKind() ?? "adult";
  }
  const profiles = getPageData()?.profiles ?? [];
  return profiles.find((p) => p.id === profileId)?.kind ?? "adult";
}

/**
 * The accent for one learner, or for the learner at the keyboard when no id is
 * given. A stored value that does not belong to the learner's kind is ignored
 * rather than honoured — a child must not end up wearing Sepia because their
 * profile was once an adult's, and the reverse is just as wrong.
 */
export function loadAccent(profileId?: string | null): string {
  if (!canChooseAccent()) {
    return DEFAULT_ACCENT;
  }
  const kind = kindOf(profileId);
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const stored = localStorage.getItem(profileStorageKeyFor(id, KEY));
    if (stored != null && allowed(stored, kind)) {
      return stored.startsWith(CUSTOM_PREFIX) ? stored : findAccent(stored).id;
    }
  } catch {
    // Storage may be unavailable; the default is still correct.
  }
  return defaultAccentFor(kind);
}

/** Records an accent for one learner. Refuses one the learner may not wear. */
/**
 * A theme this learner may wear. Shipped themes are keyed by kind; a theme the
 * household mixed itself is offered to grown-ups only — the designer writes a
 * palette, which is not a thing to hand a seven-year-old, and the kids list is
 * deliberately four choices wide.
 */
function allowed(accent: string, kind: "adult" | "kid"): boolean {
  if (accent.startsWith(CUSTOM_PREFIX)) {
    const own = loadCustomAccents().find((item) => item.id === accent);
    return own != null && own.forKids === (kind === "kid");
  }
  return accentAllowedFor(accent, kind);
}

export function saveAccent(accent: string, profileId?: string | null): boolean {
  if (!canChooseAccent() || !allowed(accent, kindOf(profileId))) {
    return false;
  }
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    localStorage.setItem(profileStorageKeyFor(id, KEY), accent);
    return true;
  } catch {
    return false;
  }
}

// ---- Colour-blind-friendly keyboard zones ---------------------------------

const ZONES_KEY = "keylearn.safeZones";

const THEMED_ZONES_KEY = "keylearn.themedZones";

/** Said when either zone preference moves, so the provider can repaint. */
export const ZONES_CHANGED_EVENT = "keylearn:safe-zones";

/**
 * Whether this learner wants the colour-blind-friendly finger zones.
 *
 * Per learner rather than per account, and for the same reason the accent is:
 * a household shares one login, and the child who needs this is not
 * necessarily the parent who set it up.
 *
 * Off by default. The standard zones are what most people should see, and a
 * setting that changed the keyboard for everybody in the house would be a
 * worse default than the one it replaced.
 */
export function loadSafeZones(profileId?: string | null): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    return localStorage.getItem(profileStorageKeyFor(id, ZONES_KEY)) === "1";
  } catch {
    return false;
  }
}

export function saveSafeZones(on: boolean, profileId?: string | null): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const key = profileStorageKeyFor(id, ZONES_KEY);
    if (on) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this learner wants the keyboard to wear their theme's colours.
 *
 * Off by default: the standard zones were chosen rather than computed, and
 * they stay the default for everybody who does not ask otherwise.
 *
 * Loses to the colour-blind palette when both are on. One is a preference
 * about how the keyboard looks; the other is about whether it can be read at
 * all, and that is not a contest.
 */
export function loadThemedZones(profileId?: string | null): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    return (
      localStorage.getItem(profileStorageKeyFor(id, THEMED_ZONES_KEY)) === "1"
    );
  } catch {
    return false;
  }
}

export function saveThemedZones(
  on: boolean,
  profileId?: string | null,
): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const key = profileStorageKeyFor(id, THEMED_ZONES_KEY);
    if (on) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

const CONTRAST_KEY = "keylearn.contrast";

/**
 * How hard this learner needs the text to work.
 *
 * Three steps rather than a dial. The numbers that matter here are settled —
 * WCAG asks 4.5:1 of ordinary text and 7:1 where low vision is expected — and
 * a slider hands that research back to the reader as a puzzle to solve by
 * squinting. Named for what they do to the page, not for who is expected to
 * need them: nobody should have to identify with a diagnosis to make an app
 * readable.
 */
export type ContrastPref = "default" | "clearer" | "strongest";

export function loadContrast(profileId?: string | null): ContrastPref {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const raw = localStorage.getItem(profileStorageKeyFor(id, CONTRAST_KEY));
    return raw === "clearer" || raw === "strongest" ? raw : "default";
  } catch {
    return "default";
  }
}

export function saveContrast(
  level: ContrastPref,
  profileId?: string | null,
): boolean {
  try {
    const id = profileId === undefined ? activeProfileId() : profileId;
    const key = profileStorageKeyFor(id, CONTRAST_KEY);
    if (level === "default") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, level);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this learner has anything on that changes what the app does for
 * them, as opposed to how it looks.
 *
 * This is what the mark on a learner's face means, so it has to be asked in
 * one place — a page that worked it out for itself would sooner or later
 * disagree with the page next to it. The themed keyboard is deliberately not
 * counted: it is a preference about colour, and marking it would make the mark
 * mean "has opinions" rather than "needs this".
 */
export function accessibilityActive(profileId?: string | null): boolean {
  const id = profileId === undefined ? activeProfileId() : profileId;
  return loadSafeZones(id) || loadContrast(id) !== "default";
}
