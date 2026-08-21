import { Env } from "./env.ts";

/**
 * Who is staff, answered synchronously.
 *
 * The list itself lives in the database now (see `Staff` in
 * @keylearn/database), but it cannot be *read* from there on every call:
 * `User.toPublicUser` is synchronous and serialises a user on nearly every
 * response, so a query per call would put a round-trip in front of most of
 * the app. What lives here instead is a cache that the server replaces on
 * a timer — {@link setStaffEmails} — with `isStaffEmail` reading only
 * memory.
 *
 * The staleness that buys is real and bounded: someone removed from the
 * desk keeps working sessions for up to one refresh interval. That is
 * acceptable for "take Sam off the roster" and NOT the mechanism for
 * "revoke a compromised account" — which is a session-epoch bump, is
 * immediate, and is a different control entirely.
 */

let staffEmails: ReadonlySet<string> | null = null;

/**
 * The addresses named by `STAFF_EMAILS`.
 *
 * Only two things use this: the one-time seed of the `staff` table, and the
 * fallback below. It is not the live answer to "is this person staff".
 */
export function envStaffEmails(): readonly string[] {
  return [
    ...new Set(
      Env.getString("STAFF_EMAILS", "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s !== ""),
    ),
  ];
}

/**
 * The admin addresses, and the reason this whole design is safe.
 *
 * Admin comes from the environment and from nowhere else. There is no role
 * column, no in-app promotion, and no row anywhere that grants it — so the
 * property the old env-only allowlist existed to protect survives moving
 * the roster into the database: a stolen session cannot make itself, or
 * anyone else, an admin. Changing who the admins are remains a deploy.
 *
 * Kept deliberately short. Every address here can add staff, and can open
 * the switch that stops the desk answering anybody.
 */
export function adminEmails(): readonly string[] {
  return [
    ...new Set(
      Env.getString("ADMIN_EMAILS", "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s !== ""),
    ),
  ];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (email == null || email === "") {
    return false;
  }
  return adminEmails().includes(email.toLowerCase());
}

/**
 * Installs the set read by {@link isStaffEmail}, replacing whatever was
 * there. Called at boot and by the refresh timer.
 *
 * Once this has been called even once, the `STAFF_EMAILS` fallback is
 * never consulted again — otherwise removing somebody from the database
 * while their address lingered in an old env var would silently leave them
 * with access.
 */
export function setStaffEmails(emails: Iterable<string>): void {
  staffEmails = new Set([...emails].map((s) => s.trim().toLowerCase()));
}

/** Exported for tests, which need the cache to follow the environment. */
export function resetStaffEmails(): void {
  staffEmails = null;
}

function currentSet(): ReadonlySet<string> {
  // Before the first refresh — early boot, and unit tests that never start a
  // database — fall back to the env var. Failing closed here instead would
  // mean the desk is unreachable for the first moments after every deploy,
  // and would break every test that sets STAFF_EMAILS and expects it to
  // count. The fallback stops the moment real data arrives.
  return staffEmails ?? new Set(envStaffEmails());
}

/** Every allowlisted staff email — the desk's own read-only roster view. */
export function listStaffEmails(): readonly string[] {
  // Admins are staff by definition, whether or not anyone remembered to put
  // them on the roster. Digest mail and the roster view both read this, and
  // an admin missing from their own desk's daily summary would be a
  // confusing way to discover the distinction.
  return [...new Set([...currentSet(), ...adminEmails()])];
}

/**
 * Whether `email` belongs to the support-desk staff allowlist.
 *
 * True for the admin unconditionally — see {@link listStaffEmails}.
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (email == null || email === "") {
    return false;
  }
  const normalised = email.toLowerCase();
  return isAdminEmail(normalised) || currentSet().has(normalised);
}
