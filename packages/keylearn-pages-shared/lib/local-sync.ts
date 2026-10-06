import { getPageData } from "./pagedata.tsx";
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
 * The newest stamp the account has confirmed holding, per scope.
 *
 * This is what makes a change made offline certain to arrive. A push whose
 * response is lost, refused or never sent leaves its scope behind the stamps,
 * and a scope behind its stamps is pushed again: when the connection comes
 * back, on the retry timer, and on the next load. Kept in storage, so a
 * change made on a train survives the tab being closed before it got home.
 */
const ACKED_KEY = "keylearn.sync.acked";

/**
 * Keys last written while nobody was signed in on this device.
 *
 * A guest's choices are theirs and the device's, not any account's. Without
 * this, signing in on a device a guest had been using sent everything they
 * had written — a child's whole kids world, a theme, a test history — up into
 * the account that happened to sign in, with no way to tell it apart from the
 * account's own. Guest data moves across only on purpose, by export and
 * import. A key written again while signed in is the account's from then on.
 */
const GUEST_KEY = "keylearn.sync.guest";

function readGuest(): Set<string> {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw == null ? null : JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeGuest(keys: Set<string>): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify([...keys]));
  } catch {
    // Storage full or denied: the worst case is today's behaviour.
  }
}

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
  // THE SUPPORT DESK SHARES THIS HOST (keylearn.org/desk, Oct 2026), and so
  // this browser storage. Its keys all start with `qdesk` and belong to a
  // staffer's desk, not to a learner: never mirrored into a learner account,
  // and never cleared when a learner signs out of this app.
  if (key.startsWith("qdesk")) {
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
  //
  // Only the practice RECORDS, though. The braille settings (mode, voice,
  // speed, hints, goal) have no route of their own, and excluding the whole
  // `keylearn.braille.` prefix left them on the device: a blind learner who
  // signed in somewhere new had to set their voice up again by ear.
  if (
    base === "settings" ||
    base === "settings.migrated" ||
    base === "keylearn.a11y" ||
    /^keylearn\.braille\.(progress|days|daily)(\.|$)/.test(base)
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
  // Whether this browser has already shown the tour (first-run.ts). Per
  // device by the owner's rule (5 Oct 2026): carried as account data it was
  // taken off the device at sign-out, so the tour came straight back over
  // the page the visitor landed on.
  if (base === "keylearn.tourSeen") {
    return false;
  }
  // The typing statistics (`keylearn.ngrams`) DO travel. They were kept back
  // as "rebuilt from practice", but nothing rebuilds them, so a new device
  // started the weak-pair drill and the profile chart from nothing. Writes
  // are coalesced like every other key, and a store over MAX_VALUE still
  // stays put rather than crowding everything else out of the budget.
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
/** The next retry of a push that did not land, and how long it waits. */
let retry: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 30_000;
/** Set while this module is writing, so its own writes do not restamp. */
let adopting = false;
/**
 * Set once this device has been handed back at sign-out (see
 * {@link forgetLocally}). From then on nothing is stamped or pushed: the page
 * is on its way out, and a push now would carry the removals up as deletions.
 */
let released = false;

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
 * Opens the boot window again, for a pull that is about to replace what the
 * page has just read.
 *
 * A PROFILE SWITCH IS A BOOT FOR THE LEARNER BEING SWITCHED TO. The tree
 * remounts under the new profile, reads that learner's keys from this device,
 * and the kids page writes its preferences blob back within moments — all
 * before the pull for that learner has answered. Outside a boot window those
 * writes are stamped "now", which is newer than anything on the server, so the
 * pull skipped the account's copy and the next push sent this device's stale
 * copy up over it. A child who had walked ten more lessons on the laptop came
 * back to the family tablet, switched to their profile, and the tablet quietly
 * wound the laptop's progress back. Treated as a boot, those writes are the
 * defaults they are and the account's copy wins.
 */
function reopenBootWindow(): void {
  booting = true;
  bootKeys.clear();
  const timer = setTimeout(bootDone, 10_000);
  (timer as { unref?: () => void }).unref?.();
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

  window.addEventListener("pagehide", () => flushNow(true));
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNow(true);
    } else if (document.visibilityState === "visible") {
      void pullOnReturn();
    }
  });
  // A page restored from the back-forward cache is a page that has been away,
  // exactly like a tab brought back to the front.
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) {
      void pullOnReturn();
    }
  });
  // Back online: whatever did not land while the connection was down goes now,
  // rather than waiting for the learner to change something else.
  window.addEventListener("online", () => flushNow());
}

/** Records that a key changed, and schedules the push. */
function touch(key: string): void {
  if (released || !isPortable(key)) {
    return;
  }
  if (signedOut()) {
    const guest = readGuest();
    if (!guest.has(key)) {
      guest.add(key);
      writeGuest(guest);
    }
    return; // Nothing to carry it to, and it is not any account's.
  }
  {
    const guest = readGuest();
    if (guest.delete(key)) {
      writeGuest(guest);
    }
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

function flushNow(leaving = false): void {
  if (scheduled != null) {
    clearTimeout(scheduled);
    scheduled = null;
  }
  void pushLocal(leaving);
}

function readAcked(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ACKED_KEY);
    const parsed = raw == null ? null : JSON.parse(raw);
    return parsed != null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAcked(acked: Record<string, number>): void {
  try {
    localStorage.setItem(ACKED_KEY, JSON.stringify(acked));
  } catch {
    // Without the record every scope is simply pushed again. Wasteful, safe.
  }
}

const scopeName = (profileId: string | null): string => profileId ?? "";

/** Tries again later, backing off, until a push lands. */
function scheduleRetry(): void {
  if (retry != null || released) {
    return;
  }
  retry = setTimeout(() => {
    retry = null;
    retryDelay = Math.min(retryDelay * 2, 5 * 60_000);
    void pushLocal();
  }, retryDelay);
  // A pending retry is not a reason to keep a process alive (tests, workers);
  // in a page this is a no-op.
  (retry as { unref?: () => void }).unref?.();
}

/** Collects this device's copy of one scope, newest-first within the budget. */
function collect(
  profileId: string | null,
): Mirror & { readonly newest: number } {
  const stamps = readStamps();
  const entries: { key: string; stamped: Stamped; size: number }[] = [];
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return { keys: {}, newest: 0 };
  }
  const seen = new Set<string>();
  const guest = readGuest();
  const consider = (key: string): void => {
    if (
      seen.has(key) ||
      guest.has(key) ||
      !isPortable(key) ||
      profileOf(key) !== profileId
    ) {
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
  let newest = 0;
  for (const entry of entries) {
    if (spent + entry.size > BUDGET) {
      continue;
    }
    spent += entry.size;
    keys[entry.key] = entry.stamped;
    newest = Math.max(newest, entry.stamped.t);
  }
  return { keys, newest };
}

const url = (profileId: string | null): string =>
  profileId == null
    ? "/_/sync/doc/local"
    : `/_/sync/doc/profile/${encodeURIComponent(profileId)}/local`;

/**
 * WHETHER THERE IS AN ACCOUNT TO CARRY ANYTHING TO.
 *
 * A guest has none, and every sync call they made came back 403 — one on
 * boot and another on every settings change, all day, into the console of
 * anybody trying to see what the page was actually doing. The device's copy
 * is the whole story for a guest; nothing is lost by not asking.
 *
 * Only a page that SAYS it is signed out is treated as one: with no page data
 * at all (a test, a worker) this keeps its old behaviour.
 */
function signedOut(): boolean {
  try {
    const data = getPageData();
    return data != null && data.user == null;
  } catch {
    return false;
  }
}

/** Whether this learner is one whose state can be carried at all. */
function syncable(profileId: string | null): boolean {
  return profileId == null || /^[0-9]+$/.test(profileId);
}

/**
 * EVERY LEARNER IN THE HOUSEHOLD, not only the one using the device now.
 *
 * Carrying only the active learner left two holes. A parent who changed a
 * child's accent from their own profile wrote it under the child's key, and it
 * stayed on the laptop until that child next practised there. And a fresh
 * device knew nothing about any learner but the first one opened: the course
 * pane read the other children's worlds from an empty store and reported them
 * as never started. So the account, the household's learners from page data,
 * and any learner this device holds keys for are all scopes.
 */
function scopesToSync(): (string | null)[] {
  const ids = new Set<string>();
  try {
    for (const p of getPageData()?.profiles ?? []) {
      ids.add(String(p.id));
    }
  } catch {
    // No page data: fall back to what this device itself holds.
  }
  const active = activeProfileId();
  if (active != null) {
    ids.add(active);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const id = profileOf(localStorage.key(i) ?? "");
      if (id != null) {
        ids.add(id);
      }
    }
  } catch {
    // Enumeration denied; the household list is still there.
  }
  return [null, ...[...ids].filter((id) => syncable(id))];
}

/**
 * Sends this device's copy up. Never throws.
 *
 * Both scopes: an account-level change and a profile-level one arrive through
 * the same `setItem`, and asking the caller which it was would be asking it to
 * know something it has no reason to know.
 */
export async function pushLocal(leaving = false): Promise<void> {
  if (released || signedOut()) {
    return;
  }
  const acked = readAcked();
  let failed = false;
  for (const scope of scopesToSync()) {
    const { keys, newest } = collect(scope);
    if (Object.keys(keys).length === 0) {
      continue; // Nothing to say. Notably, this never writes an empty document.
    }
    const name = scopeName(scope);
    if (name in acked && newest <= acked[name]!) {
      continue; // The account already holds everything this scope has.
    }
    const body = JSON.stringify({ keys });
    try {
      const response = await fetch(url(scope), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        // A tab being closed cancels ordinary requests, and that is exactly
        // when someone has just finished changing things. `keepalive` lets
        // this one outlive the page, within the browser's 64K allowance.
        keepalive: leaving && body.length < 60_000,
      });
      if (response.ok) {
        acked[name] = newest;
      } else {
        failed = true;
      }
    } catch {
      // Offline. The device's copy is written and correct, and the scope stays
      // behind its stamps until a push lands.
      failed = true;
    }
  }
  writeAcked(acked);
  if (failed) {
    scheduleRetry();
  } else {
    retryDelay = 30_000;
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
  if (signedOut()) {
    return false;
  }
  const active = activeProfileId();
  let changed = false;
  try {
    for (const scope of scopesToSync()) {
      // Another learner's keys change nothing on the screen in front of this
      // one, so only the account and the active learner can ask for a reload.
      if ((await pullScope(scope)) && (scope == null || scope === active)) {
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
  const guest = readGuest();
  let guestChanged = false;
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
      // Absent locally means there is nothing to lose, so it is adopted
      // whatever its stamp says.
      //
      // The comparison alone is not enough, and getting this wrong made the
      // whole thing useless on the only accounts that matter. Every key
      // migrated from before this shipped carries a stamp of zero — that is
      // what "we do not know when this was set" is written as — and a fresh
      // device has no stamp either, which also reads as zero. So `0 <= 0` was
      // true for every migrated setting, on every new device, and not one of
      // them was ever adopted. The sync appeared to work in tests, where the
      // stamps were invented, and did nothing at all in life.
      const known = key in stamps || localStorage.getItem(key) != null;
      if (known && stamped.t <= stampOf(stamps, key) && !bootKeys.has(key)) {
        continue; // This device's copy is the same age or newer.
      }
      if (!known && stamped.v == null) {
        continue; // A deletion of something this device never had.
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
      if (guest.delete(key)) {
        guestChanged = true;
      }
      changed = true;
    }
  } finally {
    adopting = false;
  }
  if (guestChanged) {
    writeGuest(guest);
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
let started = false;

export function startLocalSync(): void {
  installLocalSync();
  if (started) {
    return;
  }
  started = true;
  void adopt("boot");
  if (typeof window === "object") {
    // A household switches learners on one device all day. Each one has their
    // own scope to bring down.
    window.addEventListener(PROFILE_CHANGED_EVENT, () => {
      void onProfileSwitched();
    });
  }
}

/**
 * The learner at the keyboard has just changed: bring their copy down, with
 * anything the remounting page writes meanwhile treated as a default (see
 * {@link reopenBootWindow}), and reload if the account had something newer.
 */
export async function onProfileSwitched(): Promise<boolean> {
  reopenBootWindow();
  return await adopt(`profile:${activeProfileId() ?? ""}`);
}

/** When this tab last came back to the front and asked the account. */
let lastReturnPull = 0;

/** At most one pull per this long when a tab keeps being brought back. */
const RETURN_PULL_GAP_MS = 30_000;

/**
 * A tab coming back to the front asks the account what changed while it was
 * away.
 *
 * WITHOUT THIS A LONG-OPEN TAB WAS THE MOST DANGEROUS DEVICE IN THE HOUSE.
 * The kids page holds the learner's whole preferences blob in memory — which
 * lesson of which road, the stones on Time Keepers, the first-evers already
 * met — and writes all of it back on every milestone. A tablet left open on
 * the trail overnight, while the child walked five more lessons on the
 * laptop, wrote its overnight copy back on the first flag reached the next
 * morning, stamped newer than the laptop's, and the laptop's five lessons
 * were gone from every device. Pulling on return adopts the newer copy and
 * reloads before the first key can be typed against the old one.
 */
export async function pullOnReturn(now = Date.now()): Promise<boolean> {
  if (now - lastReturnPull < RETURN_PULL_GAP_MS) {
    return false;
  }
  lastReturnPull = now;
  return await adopt("return");
}

/** The page reload, replaceable where there is no page to reload (tests). */
let reloadPage = (): void => {
  window.location.reload();
};

/** For tests: what to call instead of reloading the page. */
export function setReloadForTests(reload: () => void): void {
  reloadPage = reload;
}

/** Pulls, and reloads if anything on screen is no longer current. */
async function adopt(scope: string): Promise<boolean> {
  let changed = false;
  try {
    changed = await pullLocal();
  } catch {
    return false; // pullLocal does not throw, but nothing here may take the page down.
  }
  if (!changed || !claimReload(scope)) {
    return changed;
  }
  try {
    reloadPage();
  } catch {
    // Nothing else to try; the settings are on the device for the next load.
  }
  return changed;
}

/**
 * How long one reason to reload stays spent.
 *
 * The guard is against a loop — a pull that somehow kept reporting changes
 * would otherwise reload the page for ever — and a loop comes round in a
 * second or two. It used to be once per scope for the life of the TAB, and
 * session storage outlives a refresh and a restored tab: a tablet that had
 * reloaded once on Monday never reloaded for that reason again, so on
 * Wednesday the pull put the laptop's newer progress into storage and left
 * the page showing Monday's, which the page then wrote back over it.
 */
const RELOAD_GAP_MS = 60_000;

/**
 * True when this reason to reload has not been used in the last minute, and
 * marks it used. Exported for its tests.
 */
export function claimReload(scope: string, now = Date.now()): boolean {
  const key = "keylearn.sync.reloaded";
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    // The old shape was a list of scopes, each spent for good. Read as spent
    // now, so an upgrade cannot itself cause a second reload.
    const done: Record<string, number> = {};
    if (Array.isArray(parsed)) {
      for (const s of parsed) {
        done[String(s)] = now;
      }
    } else if (parsed != null && typeof parsed === "object") {
      for (const [s, t] of Object.entries(parsed)) {
        if (typeof t === "number" && Number.isFinite(t)) {
          done[s] = t;
        }
      }
    }
    const last = done[scope];
    if (last != null && now - last < RELOAD_GAP_MS && now >= last) {
      return false;
    }
    done[scope] = now;
    sessionStorage.setItem(key, JSON.stringify(done));
    return true;
  } catch {
    // No session storage means no way to remember, and no way to guarantee the
    // reload does not loop. Not reloading is the safe side of that.
    return false;
  }
}

/**
 * Sends one scope's copy up now (a learner's, or the account's own when
 * `null`), and says whether the account has it.
 *
 * For sign-out, which may only clear what the account already holds: true when
 * the server took the document, or when there was nothing to send.
 */
export async function pushScopeNow(profileId: string | null): Promise<boolean> {
  if (!syncable(profileId)) {
    return false;
  }
  const { keys, newest } = collect(profileId);
  if (Object.keys(keys).length === 0) {
    return true;
  }
  try {
    const response = await fetch(url(profileId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (response.ok) {
      const acked = readAcked();
      acked[scopeName(profileId)] = newest;
      writeAcked(acked);
    }
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Removes keys from this device WITHOUT telling the account.
 *
 * A normal removal is a decision to delete and travels as a tombstone. This is
 * the device letting go of copies the account already holds, at sign-out, so
 * it must not travel: the stamps go too (so the next sign-in adopts the
 * account's copies as if this were a new device), and the mirror stops pushing
 * for the rest of the page's life.
 */
export function forgetLocally(keys: readonly string[]): void {
  released = true;
  if (scheduled != null) {
    clearTimeout(scheduled);
    scheduled = null;
  }
  const stamps = readStamps();
  adopting = true;
  try {
    for (const key of keys) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage denied; nothing more to do for this one.
      }
      delete stamps[key];
    }
  } finally {
    adopting = false;
  }
  writeStamps(stamps);
  // And what the account was known to hold: the next sign-in on this device
  // may be somebody else's, whose account holds none of it.
  try {
    window.localStorage.removeItem(ACKED_KEY);
  } catch {
    // Nothing more to do.
  }
}
