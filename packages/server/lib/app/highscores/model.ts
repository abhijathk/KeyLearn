import { Profile, User } from "@keylearn/database";
import { type HighScoresRow } from "@keylearn/highscores";
import { type AnyUser } from "@keylearn/pages-shared";

export type Entry = {
  readonly user: AnyUser | null;
  readonly layout: string;
  readonly speed: number;
  readonly score: number;
};

/**
 * Resolves each row to the person who set it.
 *
 * A result belongs to a learner profile, not to the account, so a household of
 * several grown-ups shows several distinct people. Rows recorded before results
 * were attributed per profile carry no profile id and fall back to the account.
 */
export async function mapEntries(
  rows: readonly HighScoresRow[],
): Promise<Entry[]> {
  const users = await User.loadAll(rows.map(({ user }) => user));
  const profileIds = rows
    .map(({ profile }) => profile)
    .filter((id): id is number => id != null);
  const profiles = new Map<number, Profile>(
    profileIds.length > 0
      ? (await Profile.query().findByIds([...new Set(profileIds)])).map((p) => [
          p.id!,
          p,
        ])
      : [],
  );
  return rows.map(({ user, profile, layout, speed, score }) => ({
    user: mapUser(users.get(user) ?? null, profile, profiles),
    layout: layout.id,
    speed,
    score,
  }));
}

function mapUser(
  user: User | null,
  profileId: number | null,
  profiles: Map<number, Profile>,
): AnyUser | null {
  if (user == null) {
    return null;
  }
  const profile = profileId != null ? profiles.get(profileId) : null;
  // Only show a profile that still exists AND still belongs to this account —
  // a stale id must never let one account's row display another's learner.
  const publicUser =
    profile != null && profile.userId === user.id
      ? profile.toPublicUser(user)
      : User.toPublicUser(user, 0);
  // A leaderboard entry is about who set the score, not whether the account
  // that set it happens to be staff — that isn't this public surface's
  // business to disclose about someone else.
  const { staff: _staff, ...rest } = publicUser;
  return rest as AnyUser;
}
