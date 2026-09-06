import {
  Credential,
  LearnerResponse,
  Profile,
  SecurityEvent,
  type User,
} from "@keylearn/database";
import { PublicId } from "@keylearn/publicid";
import { type UserDataFactory } from "@keylearn/result-userdata";

/**
 * Everything held about one account, in one shape.
 *
 * There are two ways this data leaves the system — the account holder
 * downloads it themselves, and a staff member answers a data request on
 * the support desk — and they must be the same bytes. Two implementations
 * is how a request comes to be answered with less than was asked for: the
 * copies drift, nobody notices, and the one that is legally binding is
 * the one that was wrong.
 *
 * So it is a function over a user, not a method on either controller.
 * Neither route can quietly grow a field the other lacks.
 */
export async function buildAccountExport(
  userData: UserDataFactory,
  user: User,
): Promise<Record<string, unknown>> {
  const profiles = await Profile.listForUser(user.id!);

  const perProfile = [];
  for (const profile of profiles) {
    const store = userData.loadProfile(user.id!, profile.id!);
    const results = [];
    if (await store.exists()) {
      for await (const result of store.read()) {
        results.push(result.toJSON());
      }
    }
    perProfile.push({ profile: profile.toDetails(), results });
  }

  // The account-level history, kept separately from the per-learner ones.
  const accountResults = [];
  const accountStore = userData.load(new PublicId(user.id!));
  if (await accountStore.exists()) {
    for await (const result of accountStore.read()) {
      accountResults.push(result.toJSON());
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    account: user.toDetails(),
    // The security trail is part of what is held about them.
    securityEvents: (await SecurityEvent.listForUser(user.id!, 200)).map((e) =>
      e.toDetails(),
    ),
    passkeys: (await Credential.listForUser(user.id!)).map((c) =>
      c.toDetails(),
    ),
    accountResults,
    profiles: perProfile,
    // Poll votes and feedback cards answered (control centre §8): the
    // comment is personal data, so it travels with everything else.
    responses: (await LearnerResponse.listForUser(user.id!)).map((r) =>
      r.toDetails(),
    ),
  };
}
