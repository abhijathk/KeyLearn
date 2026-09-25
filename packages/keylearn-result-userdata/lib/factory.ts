import { injectable } from "@fastr/invert";
import { DataDir, type LearnerOwner } from "@keylearn/config";
import { PublicId } from "@keylearn/publicid";
import { File } from "@sosimple/fsx-file";
import { UserData } from "./userdata.ts";

@injectable({ singleton: true })
export class UserDataFactory {
  constructor(readonly dataDir: DataDir) {}

  load(id: PublicId): UserData {
    return new UserData(id, this.getFile(id));
  }

  getFile(id: PublicId): File {
    if (id.example) {
      throw new TypeError();
    } else {
      return new File(this.dataDir.userStatsFile(id.id));
    }
  }

  /**
   * A learner profile's own stats file, under its owner: the household
   * account, or the organisation for an org-owned learner.
   */
  loadProfile(
    owner: LearnerOwner,
    profileId: number,
    course: string | null = null,
  ): UserData {
    return new UserData(
      // Only the ETag reads this id; an organisation's learner has no
      // account, so the learner's own id stands in.
      new PublicId(typeof owner === "number" ? owner : profileId),
      new File(this.dataDir.profileStatsFile(owner, profileId, course)),
    );
  }
}
