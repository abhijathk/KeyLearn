import {
  A11Y_CHANGED_EVENT,
  type A11yPrefs,
  pushA11y,
  saveA11yLocal,
} from "./a11y-storage.ts";

/**
 * Carrying a learner's accessibility preferences off the device they were set
 * on.
 *
 * Typeface, target size, motion, letter spacing, line height, speech rate and
 * voice lived in one browser's local storage. So a dyslexic reader set the
 * typeface and the spacing at home, opened the app at school, and got the
 * defaults; someone who needs large targets and stilled motion rebuilt every
 * setting on every device they used. These are the settings the app is
 * unusable without, held by the people least able to spare the effort of
 * setting them twice.
 *
 * Best-effort throughout, exactly like the braille sync this follows. A
 * learner who is signed out, offline, or has no profile selected gets the
 * behaviour they have today — the device's own copy, working. Nothing here is
 * ever allowed to be the reason a page does not render.
 *
 * ## Why the local copy stays
 *
 * `loadA11y` is synchronous and read during render, from a dozen places
 * (`motionStilled`, `a11yAdapted`, `streakGraceDays`). It cannot become a
 * network call without rewriting every call site and making first paint wait
 * on a fetch — which for a learner who needs reduced motion would mean the
 * animation they cannot tolerate playing before their setting arrives.
 *
 * So localStorage remains the synchronous source, and the server is reconciled
 * around it: pulled once when a profile becomes active, pushed after each
 * change.
 */

const url = (profileId: string) =>
  `/_/sync/a11y/profile/${encodeURIComponent(profileId)}`;

/** Whether this learner is one whose preferences can be carried at all. */
function syncable(profileId: string | null): profileId is string {
  return profileId != null && /^[0-9]+$/.test(profileId);
}

/**
 * Pulls the account's copy onto this device.
 *
 * Returns true when the local copy changed, so a caller can re-render.
 *
 * The empty-document case is the one that matters and is easy to get wrong.
 * A learner who has been using this app already has preferences on the device
 * and nothing on the server, because nothing has ever pushed them. Treating
 * "server has none" as "learner has none" would wipe their settings the moment
 * this ships — the upgrade would look exactly like the bug it fixes, and to
 * the same people. So an empty server takes the device's copy instead.
 */
export async function pullA11y(profileId: string | null): Promise<boolean> {
  if (!syncable(profileId)) {
    return false;
  }
  let remote: Partial<A11yPrefs> | null = null;
  try {
    const response = await fetch(url(profileId));
    if (!response.ok) {
      return false;
    }
    remote = (await response.json()) as Partial<A11yPrefs>;
  } catch {
    return false; // Offline, or signed out. The device's own copy stands.
  }
  if (
    remote == null ||
    typeof remote !== "object" ||
    Object.keys(remote).length === 0
  ) {
    // Nothing stored for this learner yet. If this device has settings, they
    // are the only copy in existence — send them up rather than leave them
    // one cache-clear from gone.
    void pushA11y(profileId);
    return false;
  }
  // Field-by-field defaulting happens in loadA11y, so a document written by an
  // older or newer version is safe to adopt whole.
  saveA11yLocal(remote, profileId);
  // Announced, or the settings sit in storage unread until the next reload —
  // which for the learner looks exactly like the sync not working. Every
  // consumer already listens for this; the preferences pane fires it on save.
  if (typeof window === "object") {
    window.dispatchEvent(new window.Event(A11Y_CHANGED_EVENT));
  }
  return true;
}

/**
 * Removes the account's copy.
 *
 * The counterpart to clearing on the device: without it, resetting
 * preferences would clear them locally and have them handed straight back by
 * the next pull.
 */
export async function clearRemoteA11y(profileId: string | null): Promise<void> {
  if (!syncable(profileId)) {
    return;
  }
  try {
    await fetch(url(profileId), { method: "DELETE" });
  } catch {
    // Nothing to do: the local clear already happened.
  }
}
