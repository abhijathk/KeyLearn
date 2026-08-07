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
