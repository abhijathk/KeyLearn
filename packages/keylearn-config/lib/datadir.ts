import { join } from "node:path";
import { inject, injectable } from "@fastr/invert";

/**
 * Whose folder a learner's files live in. A household learner's are under the
 * account that owns them; an organisation-owned learner (mode A in
 * docs/organisations.md, `profile.user_id` NULL) has no household, so theirs
 * are under the organisation — never under whichever account's device the
 * child happened to practise on.
 */
export type LearnerOwner = number | { readonly organizationId: number };

/**
 * The folder levels for an owner. An account fans out three levels by its
 * padded id; an organisation sits beside them under `org/`, which can never
 * collide with an account's three-digit first level.
 */
function ownerParts(owner: LearnerOwner): string[] {
  if (typeof owner === "number") {
    const s = String(owner).padStart(9, "0");
    return [s.substring(0, 3), s.substring(3, 6), s];
  }
  return ["org", String(owner.organizationId).padStart(9, "0")];
}

@injectable()
export class DataDir {
  constructor(@inject("dataDir") readonly dataDir: string) {}

  dataPath(...parts: readonly string[]): string {
    return join(this.dataDir, ...parts);
  }

  /**
   * Returns the full path to a user settings file for the given user id.
   */
  userSettingsFile(userId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "user_settings", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
    );
  }

  /**
   * Where one support attachment's bytes live.
   *
   * Same three-level fan-out as the stats files above, keyed on the
   * attachment's own id rather than the user's: a directory with several
   * thousand entries is slow to list on every filesystem worth naming, and
   * these accumulate faster than accounts do.
   *
   * The bytes are deliberately not in the database. A screenshot of a
   * broken certificate is a few hundred kilobytes of opaque data that no
   * query ever looks inside, and putting it in a row makes every backup,
   * dump and replica carry it. The row keeps the name, the type and the
   * size; the disk keeps the file.
   */
  supportAttachmentFile(attachmentId: number): string {
    const s = String(attachmentId).padStart(9, "0");
    return this.dataPath(
      "support_attachments", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
    );
  }

  /**
   * Returns the full path to a user stats file for the given user id.
   */
  userStatsFile(userId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "user_stats", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
    );
  }

  /**
   * Returns the full path to one learner profile's settings — practice and
   * accessibility preferences, synced per profile rather than per account
   * (see `keylearn-settings-loader`), since the person who needs larger
   * targets or a slower default speed is not necessarily the one who signed
   * in.
   */
  profileSettingsFile(owner: LearnerOwner, profileId: number): string {
    return this.dataPath(
      "profile_settings", //
      ...ownerParts(owner),
      String(profileId),
    );
  }

  /**
   * Returns the full path to a learner's braille progress.
   *
   * Its own file rather than a corner of the stats one: braille progress is a
   * different shape from typing results — cells and chord times rather than
   * lessons — and it is written by a page that produces no results at all.
   */
  brailleProgressFile(owner: LearnerOwner, profileId: number): string {
    return this.dataPath(
      "braille_progress", //
      ...ownerParts(owner),
      String(profileId),
    );
  }

  /**
   * Returns the full path to a learner's accessibility preferences.
   *
   * Its own file, beside the braille one and for the same reason: these are
   * not results and are not settings in the practice sense — they are how a
   * learner needs the app presented to them at all. Typeface, target size,
   * motion, spacing, speech rate and voice.
   *
   * They lived only in the browser until now, which meant the learners most
   * dependent on them — a dyslexic reader, someone who needs large targets and
   * stilled motion — had to rediscover and rebuild every one of them on every
   * device they sat down at. That is the opposite of an accessibility feature.
   */
  /**
   * Returns the full path to one of a learner's small documents.
   *
   * A generic slot rather than a new method per store. The app kept growing
   * per-device state — accessibility, the kids world's setup, a custom theme,
   * streaks, test history — and each one was written straight to
   * localStorage because giving it an endpoint meant a route, a path helper
   * and a client module. That cost is why none of them synced.
   *
   * `name` is checked against an allow-list at the route, so this is a fixed
   * set of documents rather than an open blob store on someone's account.
   */
  profileDocFile(owner: LearnerOwner, profileId: number, name: string): string {
    return this.dataPath(
      "profile_doc", //
      ...ownerParts(owner),
      `${profileId}.${name}`,
    );
  }

  /**
   * The same, for a document that belongs to the account rather than to one
   * learner — the order the profiles are shown in, for instance.
   */
  accountDocFile(userId: number, name: string): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "account_doc", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
      name,
    );
  }

  a11yPrefsFile(owner: LearnerOwner, profileId: number): string {
    return this.dataPath(
      "a11y_prefs", //
      ...ownerParts(owner),
      String(profileId),
    );
  }

  /**
   * Returns the full path to a per-profile stats file: one file per learner
   * profile, grouped under its owning account.
   */
  profileStatsFile(
    owner: LearnerOwner,
    profileId: number,
    // A course other than the guided one keeps its own file beside it. Classic
    // is a separate course rather than a second face of the same lesson, so
    // its speeds, its streak and its unlocked keys are its own — and a result
    // carries no record of which mode produced it, so they could never have
    // been told apart afterwards.
    course: string | null = null,
  ): string {
    return this.dataPath(
      "profile_stats", //
      ...ownerParts(owner),
      course == null ? String(profileId) : `${profileId}.${course}`,
    );
  }
}
