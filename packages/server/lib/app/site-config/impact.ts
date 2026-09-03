import { Profile, User } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { countPlaces } from "@keylearn/pages-shared";
import { profileCaps } from "./readers.ts";

/**
 * The numbers the confirmation dialog shows before a risky switch (spec
 * phase 2.5): how many households sit at the free profile cap, how many
 * kid profiles a Kids-off would hide, how many verified accounts a
 * maintenance switch reaches. Cheap counts, computed on request by the
 * control centre only; a failure returns zeros rather than blocking the page.
 */
export type ImpactCounts = {
  readonly verifiedAccounts: number;
  readonly kidProfiles: number;
  readonly householdsAtFreeCap: number;
};

export async function impactCounts(): Promise<ImpactCounts> {
  try {
    const [verifiedAccounts, kidProfiles, profiles] = await Promise.all([
      User.query().where("emailVerified", true).resultSize(),
      Profile.query().where("kind", "kid").resultSize(),
      Profile.query().select("userId", "visionSupport"),
    ]);
    const byUser = new Map<number, { visionSupport: boolean }[]>();
    for (const row of profiles) {
      const list = byUser.get(row.userId!) ?? [];
      list.push({ visionSupport: Boolean(row.visionSupport) });
      byUser.set(row.userId!, list);
    }
    const caps = profileCaps();
    let householdsAtFreeCap = 0;
    for (const list of byUser.values()) {
      if (countPlaces(list, false, caps).sightedFree === 0) {
        householdsAtFreeCap++;
      }
    }
    return { verifiedAccounts, kidProfiles, householdsAtFreeCap };
  } catch (err: any) {
    Logger.warn(err, "Impact counts failed");
    return { verifiedAccounts: 0, kidProfiles: 0, householdsAtFreeCap: 0 };
  }
}
