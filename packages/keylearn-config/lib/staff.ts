import { Env } from "./env.ts";

let staffEmails: ReadonlySet<string> | null = null;

function loadStaffEmails(): ReadonlySet<string> {
  return (staffEmails ??= new Set(
    Env.getString("STAFF_EMAILS", "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== ""),
  ));
}

/** Exported for tests, which need the cached set to follow the environment. */
export function resetStaffEmails(): void {
  staffEmails = null;
}

/** Every allowlisted staff email — the desk's own read-only roster view. */
export function listStaffEmails(): readonly string[] {
  return [...loadStaffEmails()];
}

/**
 * Whether `email` belongs to the support-desk staff allowlist.
 *
 * "Who is staff" lives entirely in the `STAFF_EMAILS` env var, read once and
 * cached — not in the database — so granting or revoking access is a deploy,
 * not an in-app action, and a stolen session cannot promote a second account.
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (email == null || email === "") {
    return false;
  }
  return loadStaffEmails().has(email.toLowerCase());
}
