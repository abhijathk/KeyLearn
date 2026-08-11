import { injectable } from "@fastr/invert";
import { DataDir } from "@keylearn/config";
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

  /** A learner profile's own stats file, under its owning account. */
  loadProfile(
    userId: number,
    profileId: number,
    course: string | null = null,
  ): UserData {
    return new UserData(
      new PublicId(userId),
      new File(this.dataDir.profileStatsFile(userId, profileId, course)),
    );
  }
}
