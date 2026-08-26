import { activeProfileId, PROFILE_CHANGED_EVENT } from "./profile-storage.ts";

/**
 * Everything a learner sets, carried between their devices.
 *
 * ## The bug this exists for
 *
 * A customer reported that nothing set on one device appeared on another: not
 * the theme, not the accessibility settings, not the kids world they had built,
 * not a single preference. Signing in on a laptop gave a stranger's blank app,
 * and every setting had to be made again.
 *
 * The cause was not one broken sync. It was that there had never been one. The
 * app writes about thirty-five distinct things to `localStorage` across twenty
 * files — the kids world's whole setup, custom theme colours, practice view and
 * text size, streaks, best scores, test history, the order the learners appear
 * in, accent choices, tours already seen — and each of them was written there
 * because localStorage is one line and an endpoint is a route, a path helper, a
 * client module and a migration. Nobody made a wrong decision; the cost of the
 * right one was just always higher than the value of that one setting.
 *
 * ## Why this is a mirror rather than more endpoints
 *
 * Carrying those one at a time is thirty-five decisions, each of which somebody
 * can forget to make — which is precisely the mistake that produced the bug,
 * repeated thirty-five times. And the thirty-sixth setting, added next month by
 * someone who has not read this file, would arrive device-local like all the
 * others and the customer would report it again.
 *
 * So this carries the storage itself. `localStorage.setItem` is the one call
 * every one of those writes already goes through, so that is where the sync
 * goes. A new setting is portable because it is a setting, not because someone
 * remembered to make it portable.
 *
 * The consequence worth being explicit about: portability is now the default
 * and staying on the device is the thing that must be argued for. Every such
 * argument is in {@link isPortable}, with its reason.
 *
 * ## Reconciling two devices
 *
 * Per key, last write wins. Each key carries the millisecond it was last set;
 * a pull adopts a remote key only when its stamp is newer than the local one,
 * and pushes back anything the account has not seen. So two devices open at
 * once do not overwrite each other wholesale — a theme changed on the tablet
 * and a lesson length changed on the laptop both survive, and each device shows
 * the other's change the next time it loads.
 *
 * Deletions travel as tombstones, since a key that has been cleared and a key
 * that never existed are the same absence, and without them clearing a setting
 * on one device would have it handed straight back by the other.
 *
 * ## What this may never do
 *
 * Break the app when it fails. A signed-out, offline, or storage-denied learner
 * gets exactly today's behaviour: the device's own copy, working. Every path
 * here swallows its errors and every write to the device happens before the
 * network is touched.
 */

/** One stored value, and when it was last set. `null` is a tombstone. */
type Stamped = { readonly v: string | null; readonly t: number };

type Mirror = { readonly keys: Record<string, Stamped> };

/** Where the stamps live between page loads. Never itself mirrored. */
const STAMPS_KEY = "keylearn.sync.stamps";

/**
 * How long a tombstone is kept.
 *
 * Long enough that a device left in a drawer for a month does not resurrect a
 * setting the learner deleted; short enough that the mirror does not accrete
 * the name of everything ever stored.
 */
const TOMBSTONE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The most one mirror may weigh, under the route's own 256K limit.
 *
 * A budget rather than a hope: browser storage has no size discipline, and one
 * learner with a very long custom word list should degrade to "that one key
 * does not travel" rather than to "nothing travels" or to a rejected request.
 */
const BUDGET = 192 * 1024;

/** The largest single value worth carrying. */
const MAX_VALUE = 48 * 1024;

/**
 * Whether a key belongs to the person or to the device.
 *
 * Portable by default — that is the whole point — so this lists only what must
 * NOT travel, and why. A key needs an entry here when carrying it would be
 * wrong, not merely when nobody has thought about it.
 */
export function isPortable(key: string): boolean {
  // This module's own bookkeeping. Mirroring the stamps would make every push
  // change the thing the next push is measured against.
  if (key.startsWith("keylearn.sync.")) {
    return false;
  }
  // Which learner is using THIS device right now. A household shares one
  // account: syncing the selection would switch a child's tablet to whichever
  // profile a parent last opened on the laptop, mid-lesson.
  if (key.startsWith("keylearn.activeProfile.")) {
    return false;
  }
  const base = key.replace(/^profile-[^.]+\./, "");
  // Already carried, by mechanisms that do more than copy bytes.
  //
  // Settings and accessibility preferences have their own routes. Braille
  // progress has one too, and it MERGES rather than replaces — it is a record
  // of practice that really happened on both devices, and last-write-wins would
  // silently discard a session. Letting the mirror also carry these would mean
  // two syncs racing over one key, with the cruder one winning half the time.
  if (
    base === "settings" ||
    base === "settings.migrated" ||
    base === "keylearn.a11y" ||
    base.startsWith("keylearn.braille.")
  ) {
    return false;
  }
  // A queue of messages waiting to be sent to support. Copying a send queue to
  // a second device is how somebody's question gets asked twice.
  if (base === "keylearn.support.outbox") {
    return false;
  }
  // When this device last nagged an anonymous visitor to sign in. Per device by
  // definition, and carrying it would let one device silence another's prompt.
  if (base === "keylearn.loginPromptLastShown") {
    return false;
  }
  // Derived typing statistics, rebuilt from practice: large, hot, and written
  // during a lesson. It is an output of the results that already sync, so
  // carrying it would spend the budget re-sending a conclusion rather than the
  // evidence, and would push on every keystroke's worth of change.
  if (base === "keylearn.ngrams") {
    return false;
  }
  return true;
}

/** True for keys belonging to one learner rather than to the account. */
function profileOf(key: string): string | null {
  const match = /^profile-([^.]+)\./.exec(key);
  return match == null ? null : match[1];
}

function readStamps(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STAMPS_KEY);
    const parsed = raw == null ? null : JSON.parse(raw);
    return parsed != null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStamps(stamps: Record<string, number>): void {
  try {
    localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps));
  } catch {
    // Storage full or denied. The mirror degrades to whole-document
    // last-write-wins, which is worse but not broken.
  }
}

/**
 * The moment a key was last set on this device.
 *
 * Keys written before this shipped have no stamp. They are dated to zero rather
 * than to now, so that anything the account already holds is preferred over a
 * value of unknown age — but they still push up when the account holds nothing,
 * which is how an existing learner's settings reach the server the first time.
 */
function stampOf(stamps: Record<string, number>, key: string): number {
  const t = stamps[key];
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

let installed = false;
let scheduled: ReturnType<typeof setTimeout> | null = null;
/** Set while this module is writing, so its own writes do not restamp. */
let adopting = false;

/**
 * Keys written while the page was still starting up.
 *
 * A default is not a decision. Several packages write their defaults into
 * storage on boot — the settings store, the theme, the kids page — and those
 * writes land before the account's copy has finished arriving. Stamped with the
 * moment they happened, they would be newer than anything on the server, so the
 * pull would skip them and the next push would send this device's defaults up
 * over the learner's real settings. The upgrade would look exactly like the bug
 * it fixes.
 *
 * Nobody can have chosen anything in the few hundred milliseconds before the
 * page has finished loading, so for these keys the account's copy wins
 * regardless of stamps.
 */
const bootKeys = new Set<string>();
let booting = true;

/** Ends the boot window, however the first pull turned out. */
function bootDone(): void {
  if (booting) {
    booting = false;
    bootKeys.clear();
  }
}

/**
 * Starts recording changes and sending them up.
 *
 * ## Why this patches the prototype and not the object
 *
 * The obvious version — `localStorage.setItem = wrapped` — silently does
 * something else entirely. `Storage` has a named-property setter, so assigning
 * to a property of it is defined as storing an entry: the effect of that line
 * is a stored key called "setItem" whose value is the source text of the
 * function, the real method untouched, and the hook never called. The sync
 * would have been inert, and would have quietly mirrored its own wrapper to
 * every device.
 *
 * So the patch goes on the prototype, which is an ordinary object and can be
 * written to. That prototype is shared with `sessionStorage`, which is meant to
 * be per tab and must not be carried anywhere, hence the check on which storage
 * is actually being written to.
 */
export function installLocalSync(): void {
  if (installed || typeof window !== "object") {
    return;
  }
  let storage: Storage;
  try {
    storage = window.localStorage;
    storage.getItem(STAMPS_KEY); // Throws in a denied or partitioned context.
  } catch {
    return; // No storage at all. Nothing to carry, and nothing to break.
  }
  installed = true;

  const proto = Object.getPrototypeOf(storage) as Storage;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;

  proto.setItem = function (this: Storage, key: string, value: string): void {
    setItem.call(this, key, value);
    if (this === storage && !adopting) {
      touch(key);
    }
  };
  proto.removeItem = function (this: Storage, key: string): void {
    removeItem.call(this, key);
    if (this === storage && !adopting) {
      touch(key);
    }
  };

  // A push in flight when the tab closes is a lost change, and closing the tab
  // is exactly when someone has just finished changing things. These two events
  // are the pair that actually fire on mobile, where `unload` does not.
  // However the first pull goes, boot is over shortly after the page is: a
  // pull that never resolves must not leave every later write treated as a
  // default forever.
  setTimeout(bootDone, 10_000);

  window.addEventListener("pagehide", flushNow);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNow();
    }
  });
}

/** Records that a key changed, and schedules the push. */
function touch(key: string): void {
  if (!isPortable(key)) {
    return;
  }
  const stamps = readStamps();
  stamps[key] = Date.now();
  writeStamps(stamps);
  if (booting) {
    // A default being written into an empty store, not a learner choosing
    // something. Recorded so the pull can overrule it, and not pushed — sending
    // it now would race the pull and could overwrite the account with defaults.
    bootKeys.add(key);
    return;
  }
  // Coalesced: dragging a colour picker writes on every frame, and each of
  // those is a change worth keeping but not a request worth making.
  if (scheduled != null) {
    clearTimeout(scheduled);
  }
  scheduled = setTimeout(flushNow, 1500);
}

function flushNow(): void {
  if (scheduled != null) {
    clearTimeout(scheduled);
    scheduled = null;
  }
  void pushLocal();
}

/** Collects this device's copy of one scope, newest-first within the budget. */
function collect(profileId: string | null): Mirror {
  const stamps = readStamps();
  const entries: { key: string; stamped: Stamped; size: number }[] = [];
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return { keys: {} };
  }
  const seen = new Set<string>();
  const consider = (key: string): void => {
    if (seen.has(key) || !isPortable(key) || profileOf(key) !== profileId) {
      return;
    }
    seen.add(key);
    let value: string | null = null;
    try {
      value = storage.getItem(key);
    } catch {
      return;
    }
    if (value != null && value.length > MAX_VALUE) {
      return; // Too large to be worth anyone's bandwidth. Stays on the device.
    }
    const t = stampOf(stamps, key);
    if (value == null && Date.now() - t > TOMBSTONE_MS) {
      return; // An old deletion everyone has long since heard about.
    }
    entries.push({
      key,
      stamped: { v: value, t },
      size: key.length + (value?.length ?? 0) + 32,
    });
  };
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key != null) {
        consider(key);
      }
    }
  } catch {
    // Enumeration failed; whatever was collected still goes.
  }
  // Stamped keys that are no longer present are deletions, and are the reason
  // clearing a setting propagates at all.
  for (const key of Object.keys(stamps)) {
    consider(key);
  }
  // Newest first, so that if a learner has more state than the budget allows,
  // what travels is what they touched most recently rather than whatever the
  // browser happened to enumerate first.
  entries.sort((a, b) => b.stamped.t - a.stamped.t);
  const keys: Record<string, Stamped> = {};
  let spent = 0;
  for (const entry of entries) {
    if (spent + entry.size > BUDGET) {
      continue;
    }
    spent += entry.size;
    keys[entry.key] = entry.stamped;
  }
  return { keys };
}

const url = (profileId: string | null): string =>
  profileId == null
    ? "/_/sync/doc/local"
    : `/_/sync/doc/profile/${encodeURIComponent(profileId)}/local`;

/** Whether this learner is one whose state can be carried at all. */
function syncable(profileId: string | null): boolean {
  return profileId == null || /^[0-9]+$/.test(profileId);
}

/**
 * Sends this device's copy up. Never throws.
 *
 * Both scopes: an account-level change and a profile-level one arrive through
 * the same `setItem`, and asking the caller which it was would be asking it to
 * know something it has no reason to know.
 */
export async function pushLocal(): Promise<void> {
  const profileId = activeProfileId();
  const scopes: (string | null)[] = [null];
  if (profileId != null && syncable(profileId)) {
    scopes.push(profileId);
  }
  for (const scope of scopes) {
    const mirror = collect(scope);
    if (Object.keys(mirror.keys).length === 0) {
      continue; // Nothing to say. Notably, this never writes an empty document.
    }
    try {
      await fetch(url(scope), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mirror),
      });
    } catch {
      // Offline, or signed out. The device's copy is already written and
      // correct; it goes up on the next change or the next load.
    }
  }
}

/**
 * Brings the account's copy down onto this device.
 *
 * Returns true when anything changed locally, so a caller can re-render rather
 * than leave the page showing settings that are no longer the current ones.
 *
 * The case worth the most care is an account with nothing stored. Every learner
 * using the app today has their settings on the device and nothing on the
 * server, because until now nothing ever sent them. Reading "the account has
 * none" as "the learner has none" would erase the settings of every existing
 * user on the day we said we had fixed this — the same loss, by our own hand,
 * dressed as the repair. So an empty account takes this device's copy instead.
 */
export async function pullLocal(): Promise<boolean> {
  const profileId = activeProfileId();
  const scopes: (string | null)[] = [null];
  if (profileId != null && syncable(profileId)) {
    scopes.push(profileId);
  }
  let changed = false;
  try {
    for (const scope of scopes) {
      if (await pullScope(scope)) {
        changed = true;
      }
    }
  } finally {
    // Whatever came down, boot is over: from here a write is a choice.
    bootDone();
  }
  // Once, after both scopes, rather than inside each: anything this device
  // holds that the account has not seen — including every key written before
  // any of this existed — goes up in one pass.
  void pushLocal();
  return changed;
}

async function pullScope(profileId: string | null): Promise<boolean> {
  let remote: Mirror | null = null;
  try {
    const response = await fetch(url(profileId));
    if (!response.ok) {
      return false; // A failed read is not an empty account.
    }
    remote = (await response.json()) as Mirror;
  } catch {
    return false; // Offline, or signed out. The device's copy stands.
  }
  const keys =
    remote != null && typeof remote === "object" && remote.keys != null
      ? remote.keys
      : null;
  if (keys == null || Object.keys(keys).length === 0) {
    // Nothing stored for this scope yet: this device's copy is the only one in
    // existence, and the push at the end of the pull sends it up rather than
    // leaving it one cleared cache from gone.
    return false;
  }
  const stamps = readStamps();
  let changed = false;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return false;
  }
  adopting = true;
  try {
    for (const [key, stamped] of Object.entries(keys)) {
      if (
        !isPortable(key) ||
        profileOf(key) !== profileId ||
        stamped == null ||
        typeof stamped.t !== "number"
      ) {
        continue; // Not this scope's to write, or not a value we understand.
      }
      if (stamped.t <= stampOf(stamps, key) && !bootKeys.has(key)) {
        continue; // This device's copy is the same age or newer.
      }
      try {
        if (stamped.v == null) {
          storage.removeItem(key);
        } else if (typeof stamped.v === "string") {
          storage.setItem(key, stamped.v);
        } else {
          continue;
        }
      } catch {
        continue; // Storage full. The rest may still fit.
      }
      // Stamped with the remote time, not with now: this device did not make
      // this change, and claiming it did would have it push the value straight
      // back and win against a device that really is newer.
      stamps[key] = stamped.t;
      changed = true;
    }
  } finally {
    adopting = false;
  }
  if (changed) {
    writeStamps(stamps);
  }
  return changed;
}

/**
 * What a page calls once, as early as it can.
 *
 * Installed before the first render, because several packages write their
 * defaults into storage while they boot and the mirror has to be watching to
 * know those writes for what they are.
 *
 * ## Why this reloads the page
 *
 * The pull finishes after the app has already read storage and drawn itself, so
 * adopting the account's settings at that moment leaves the page showing the
 * old ones. There is no general way to tell twenty packages that the value they
 * read half a second ago has changed — a11y has an event because somebody wrote
 * one, and most of the rest have nothing.
 *
 * A reload is the honest version of what the customer asked for: sign in on a
 * new device and it is your app. It happens only when the account actually had
 * something newer to give — the common case, an already-synced device, does not
 * reload at all — and at most once per scope per tab, so a pull that somehow
 * kept reporting changes could not put the page in a loop.
 */
export function startLocalSync(): void {
  installLocalSync();
  void adopt("boot");
  if (typeof window === "object") {
    // A household switches learners on one device all day. Each one has their
    // own scope to bring down.
    window.addEventListener(PROFILE_CHANGED_EVENT, () => {
      void adopt(`profile:${activeProfileId() ?? ""}`);
    });
  }
}

async function adopt(scope: string): Promise<void> {
  let changed = false;
  try {
    changed = await pullLocal();
  } catch {
    return; // pullLocal does not throw, but nothing here may take the page down.
  }
  if (!changed || !claimReload(scope)) {
    return;
  }
  try {
    window.location.reload();
  } catch {
    // Nothing else to try; the settings are on the device for the next load.
  }
}

/** True the first time a scope asks to reload in this tab, false after. */
function claimReload(scope: string): boolean {
  const key = "keylearn.sync.reloaded";
  try {
    const done = new Set<string>(
      JSON.parse(sessionStorage.getItem(key) ?? "[]"),
    );
    if (done.has(scope)) {
      return false;
    }
    done.add(scope);
    sessionStorage.setItem(key, JSON.stringify([...done]));
    return true;
  } catch {
    // No session storage means no way to remember, and no way to guarantee the
    // reload happens only once. Not reloading is the safe side of that.
    return false;
  }
}
