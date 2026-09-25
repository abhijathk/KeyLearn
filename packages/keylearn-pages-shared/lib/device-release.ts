import { loadA11y } from "./a11y-storage.ts";
import { forgetLocally, isPortable, pushScopeNow } from "./local-sync.ts";

/**
 * What a shared computer keeps of a household after it signs out.
 *
 * Signing out used to end the session and leave every learner's copy in
 * this browser's storage: their settings, accessibility needs, theme, kids
 * world and braille progress, readable by whoever sat down next. None of it
 * was shown while signed out, but none of it was gone either.
 *
 * The rule is that a key leaves only when the account is known to hold what it
 * holds. Nothing here may cost a learner anything they cannot get back by
 * signing in again, so every class is checked the way it is stored:
 *
 * - the mirror (most keys) is pushed now, and removed only if the push landed;
 * - settings and accessibility have their own routes and are write-through, so
 *   they are compared with the account's copy and removed only when identical
 *   (a change made offline, not yet sent, stays);
 * - braille progress merges on the server, so it is sent and removed only if
 *   that landed;
 * - a support message still queued to send stays, whatever else goes.
 *
 * Which learner this device last used (`keylearn.activeProfile.*`) is a fact
 * about the device, not the account, and is kept so the next sign-in lands on
 * the same learner. So is everything a signed-out visitor uses, which is never
 * prefixed with a learner.
 */
export async function releaseDevice(
  profileIds: readonly string[],
  expired: () => boolean = () => false,
): Promise<void> {
  const remove: string[] = [];
  for (const id of profileIds) {
    if (!/^[0-9]+$/.test(id)) {
      continue;
    }
    const prefix = `profile-${id}.`;
    const keys = storageKeys().filter((key) => key.startsWith(prefix));
    const mirrored = await pushScopeNow(id);
    if (mirrored) {
      // Deletions this learner made live on only as stamps, and the push just
      // delivered them. Left behind, they would be sent again at the next
      // sign-in and delete whatever the account has set since.
      for (const key of stampedKeys()) {
        if (key.startsWith(prefix) && !keys.includes(key)) {
          remove.push(key);
        }
      }
    }
    for (const key of keys) {
      const base = key.slice(prefix.length);
      if (
        base === "settings" ||
        base === "settings.migrated" ||
        base === "keylearn.a11y"
      ) {
        continue; // Checked against their own routes below.
      }
      if (base === "keylearn.support.outbox") {
        if (emptyQueue(read(key))) {
          remove.push(key);
        }
        continue;
      }
      if (isPortable(key)) {
        if (mirrored) {
          remove.push(key);
        }
        continue;
      }
      // Not carried by the mirror and not one of the above: derived from
      // results the account already has (n-grams), or a per-device nudge.
      remove.push(key);
    }
    const settings = read(`${prefix}settings`);
    if (
      settings != null &&
      (await sameOnServer(`/_/sync/profile-settings/${id}`, [settings]))
    ) {
      remove.push(`${prefix}settings`, `${prefix}settings.migrated`);
    }
    const a11y = read(`${prefix}keylearn.a11y`);
    if (
      a11y != null &&
      (await sameOnServer(`/_/sync/a11y/profile/${id}`, [
        a11y,
        JSON.stringify(loadA11y(id)),
      ]))
    ) {
      remove.push(`${prefix}keylearn.a11y`);
    }
    const braille = [
      `keylearn.braille.progress.${id}`,
      `keylearn.braille.days.${id}`,
      `keylearn.braille.daily.${id}`,
    ];
    if (read(braille[0]!) != null && (await sendBraille(id, braille))) {
      remove.push(...braille);
    }
  }
  // The account's own scope: keys with no learner prefix that the mirror
  // carries for the account (recent texts, the mode last chosen). A signed-out
  // visitor uses the same names, so they go only once the account has them —
  // and with their stamps, or the next person to sign in on this computer
  // would push them into THEIR account.
  if (await pushScopeNow(null)) {
    const unprefixed = (key: string) => !/^profile-[^.]+\./.test(key);
    for (const key of new Set([...storageKeys(), ...stampedKeys()])) {
      if (unprefixed(key) && isPortable(key)) {
        remove.push(key);
      }
    }
  }
  if (expired()) {
    return; // Took too long; sign-out went ahead, and the device keeps all.
  }
  forgetLocally(remove);
}

function storageKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key != null) {
        keys.push(key);
      }
    }
  } catch {
    // Storage denied: nothing to release.
  }
  return keys;
}

function stampedKeys(): string[] {
  try {
    const stamps = JSON.parse(read("keylearn.sync.stamps") ?? "{}");
    return stamps != null && typeof stamps === "object"
      ? Object.keys(stamps)
      : [];
  } catch {
    return [];
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function emptyQueue(raw: string | null): boolean {
  if (raw == null) {
    return true;
  }
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}

/** Whether the account's copy is the same as one of this device's forms. */
async function sameOnServer(
  url: string,
  locals: readonly string[],
): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    const remote = canonical(await response.json());
    return locals.some((local) => canonical(JSON.parse(local)) === remote);
  } catch {
    return false;
  }
}

/** The braille snapshot, as the braille sync sends it. */
async function sendBraille(
  id: string,
  [progressKey, daysKey, dailyKey]: string[],
): Promise<boolean> {
  try {
    const response = await fetch(
      `/_/sync/braille/profile/${encodeURIComponent(id)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          progress: JSON.parse(read(progressKey!) ?? "null"),
          days: JSON.parse(read(daysKey!) ?? "[]"),
          daily: JSON.parse(read(dailyKey!) ?? "{}"),
          savedAt: Date.now(),
        }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/** JSON with object keys sorted, so two equal values compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v != null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}
