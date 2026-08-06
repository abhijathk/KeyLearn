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
