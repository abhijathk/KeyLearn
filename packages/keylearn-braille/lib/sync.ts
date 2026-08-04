import { mergeSnapshots } from "./merge.ts";
import { restore, type Snapshot, snapshot } from "./storage.ts";

/**
 * Carrying a learner's braille progress off the device it was made on.
 *
 * Every other kind of progress in the app follows the learner to whatever
 * machine they sit down at. Braille did not: it lived in one browser's local
 * storage, so a new laptop, a reinstalled browser or simply a second device in
 * the same house meant starting again at the first five cells — with the real
 * work still sitting somewhere nobody could reach it.
 *
 * Best-effort throughout. A learner who is signed out, offline, or whose
 * account has no profile selected practises exactly as before, on the device;
 * nothing here is ever allowed to be the reason a drill does not start.
 */

const url = (profileId: string) =>
  `/_/sync/braille/profile/${encodeURIComponent(profileId)}`;

/** Whether this learner is one whose progress can be carried at all. */
function syncable(profileId: string | null): profileId is string {
  return profileId != null && /^[0-9]+$/.test(profileId);
}

/**
 * Pulls the account's copy and folds it into this device's.
 *
 * Returns true when the local copy changed, so the caller knows to re-read it.
 * The merge keeps both sides — see `merge.ts` — because the two are records of
 * real practice rather than versions of one document.
 */
export async function pullProgress(profileId: string | null): Promise<boolean> {
  if (!syncable(profileId)) {
    return false;
  }
  let remote: Snapshot;
  try {
    const response = await fetch(url(profileId));
    if (!response.ok) {
      return false;
    }
    remote = (await response.json()) as Snapshot;
  } catch {
    return false; // Offline, or signed out. The device's own copy stands.
  }
  if (remote == null || typeof remote !== "object" || remote.progress == null) {
    return false; // Nothing stored for this learner yet.
  }
  const local = snapshot(profileId);
  restore(mergeSnapshots(local, remote), profileId);
  return true;
}

/** Pushes this device's copy. Never throws, never blocks the drill. */
export async function pushProgress(profileId: string | null): Promise<void> {
  if (!syncable(profileId)) {
    return;
  }
  try {
    await fetch(url(profileId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot(profileId)),
    });
  } catch {
    // The work is safe on the device; it will go up at the end of the next
    // line, or the next session.
  }
}

/**
 * Removes the account's copy.
 *
 * The counterpart to clearing on the device. Without it, "clear my statistics"
 * would delete the local copy and then have it handed straight back by the next
 * pull — the one outcome worse than not offering the button at all.
 */
export async function clearRemoteProgress(
  profileId: string | null,
): Promise<void> {
  if (!syncable(profileId)) {
    return;
  }
  try {
    await fetch(url(profileId), { method: "DELETE" });
  } catch {
    // Nothing useful to do; the local copy is gone either way.
  }
}
