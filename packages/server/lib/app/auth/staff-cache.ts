import { Env, setStaffEmails } from "@keylearn/config";
import { Staff } from "@keylearn/database";
import { Logger } from "@keylearn/logger";

/**
 * Keeps each worker's synchronous staff set in step with the database.
 *
 * `isStaffEmail` has to answer without awaiting — `User.toPublicUser` is
 * synchronous and runs on most responses — so the roster is cached in
 * memory. This is what stops that cache from being a snapshot of whatever
 * was true when the process started.
 *
 * Per worker, not in the primary. The primary is where the sweeps live
 * because they should happen once per deployment; this is the opposite
 * case — the cache being refreshed is process-local, so a refresh in the
 * primary would keep the one process that never serves a request
 * beautifully up to date and leave the four that do serving stale answers.
 *
 * The interval is the window during which a removed staff member still has
 * access. Sixty seconds is chosen against what this control is actually
 * for — taking somebody off the roster when they change teams — and not
 * for revoking a compromised account, which bumps the session epoch and
 * takes effect on the next request.
 */
export function staffRefreshIntervalMs(): number {
  return Env.getNumber("STAFF_REFRESH_SECONDS", 60) * 1000;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Loads the roster once.
 *
 * A failure leaves the previous set in place rather than emptying it: a
 * database blip must not sign every staff member out of the desk, and the
 * next tick will pick the roster up anyway. On the very first call there is
 * no previous set, and `isStaffEmail` keeps falling back to `STAFF_EMAILS`
 * until one arrives — which is the same list this table was seeded from.
 */
export async function refreshStaffCache(): Promise<void> {
  try {
    setStaffEmails(await Staff.activeEmails());
  } catch (err) {
    Logger.warn("staff: could not refresh the roster, keeping the last one", {
      err,
    });
  }
}

export function startStaffCache(): void {
  if (timer != null) {
    return;
  }
  void refreshStaffCache();
  timer = setInterval(() => void refreshStaffCache(), staffRefreshIntervalMs());
  // Never a reason to hold the process open — a pending roster refresh is not
  // work worth delaying a shutdown for.
  timer.unref?.();
}

export function stopStaffCache(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
