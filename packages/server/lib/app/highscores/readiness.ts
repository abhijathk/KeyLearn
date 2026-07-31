import { Env } from "@keybr/config";
import { User } from "@keybr/database";

/**
 * Whether there is enough of a community for a leaderboard to mean anything.
 *
 * A board with eleven people on it is not a leaderboard, it is a list — and it
 * teaches a new learner the wrong thing twice over: the top looks arbitrary, and
 * their own position is dominated by who happened to show up rather than by how
 * they are doing. Worse, on a small board most people are visibly near the
 * bottom, which is precisely the comparison that puts beginners off.
 *
 * So the whole feature — page AND navigation link — stays hidden until the
 * population is large enough for a percentile to be honest.
 *
 * Two conditions, because either alone is misleading:
 *  - enough ACTIVATED accounts (a signed-up-but-never-verified account is not a
 *    person who types), and
 *  - enough distinct learners actually ranked in the current window, since a
 *    large but inactive userbase still produces an empty board.
 */
export function minAccounts(): number {
  return Env.getNumber("LEADERBOARD_MIN_ACCOUNTS", 500);
}

export function minRanked(): number {
  return Env.getNumber("LEADERBOARD_MIN_RANKED", 50);
}

type Snapshot = { ready: boolean; accounts: number; at: number };

let cache: Snapshot | null = null;

// Counting every activated account on each page render would put a COUNT on the
// hot path for a value that changes slowly. A few minutes stale is fine.
const TTL_MS = 5 * 60 * 1000;

/**
 * Whether the leaderboard should be offered at all.
 *
 * `rankedCount` is the number of distinct learners currently on the board, which
 * the caller already has to hand.
 */
export async function leaderboardReady(rankedCount: number): Promise<boolean> {
  if (rankedCount < minRanked()) {
    return false;
  }
  const now = Date.now();
  if (cache == null || now - cache.at > TTL_MS) {
    let accounts = 0;
    try {
      accounts = await User.query().where("emailVerified", true).resultSize();
    } catch {
      // A counting failure must not decide the feature is ready.
      accounts = 0;
    }
    cache = { ready: accounts >= minAccounts(), accounts, at: now };
  }
  return cache.ready;
}

/** Forgets the cached count. For tests. */
export function resetReadinessCache(): void {
  cache = null;
}
