// Reading a row timestamp, whatever the database chose to return.

/**
 * A row timestamp as milliseconds, whatever the database returned.
 *
 * MySQL yields a `Date`; SQLite yields the string it stored. Assuming the
 * first is what broke issuing outright — `row.createdAt.getTime is not a
 * function` — and it broke it on the only database the dev environment uses.
 */
export function millis(value: Date | string | number | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    // SQLite writes "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker; without
    // the T and the Z it would be read as local time and drift by the offset.
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  // A row with an unreadable timestamp still has to be orderable. The epoch
  // sorts it oldest, which keeps it out of the recent-sittings window rather
  // than letting it masquerade as the newest.
  return 0;
}

/**
 * A stored flag as a boolean, whatever the database returned.
 *
 * SQLite has no boolean type: it hands back the integer 1 or 0, so a strict
 * `=== true` is false for a row that is plainly true. That is what made the
 * name-visibility switch look as though it never saved — the value was
 * written and read back correctly, and only the comparison was wrong.
 *
 * The same shape as `millis`, and for the same reason: MySQL and SQLite
 * disagree about types, and the disagreement is silent.
 */
export function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}
