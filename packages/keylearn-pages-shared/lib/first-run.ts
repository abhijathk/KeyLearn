/**
 * WHAT THIS BROWSER HAS ALREADY BEEN SHOWN (owner, 5 Oct 2026).
 *
 * A visitor should meet the app, not a stack of windows:
 *
 * - The tour opens once, ever, in this browser — guest or signed in. It is
 *   kept here rather than only on the account because the account's own
 *   `ui.tourSeen` does not travel: sign out, and the guest settings that take
 *   over never recorded it, so the tour came straight back over the page.
 * - The sign-up prompt does not land on the page that loads straight after
 *   signing out; a later refresh may show it.
 *
 * Every access is guarded: private windows and embedded webviews can refuse
 * storage, and the answer then errs on the side of NOT interrupting.
 */
const TOUR_SEEN_KEY = "keylearn.tourSeen";
const SIGNED_OUT_KEY = "keylearn.signedOutJustNow";

/** The tour has been finished or skipped in this browser before. */
export function tourSeenOnThisMachine(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    // Unknown is treated as seen: re-opening it on every load is the worse
    // failure of the two.
    return true;
  }
}

export function markTourSeenOnThisMachine(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Nothing to remember it in; the account setting still holds it.
  }
}

/** Set by sign-out, just before it navigates away. */
export function markSignedOutJustNow(): void {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, "1");
  } catch {
    // No session storage: the prompt may show; nothing worse happens.
  }
}

/**
 * Whether this page load is the one sign-out landed on. Consumed by the
 * first read, so the next refresh is an ordinary load again.
 */
export function takeSignedOutJustNow(): boolean {
  try {
    const was = sessionStorage.getItem(SIGNED_OUT_KEY) === "1";
    if (was) {
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    }
    return was;
  } catch {
    return false;
  }
}
