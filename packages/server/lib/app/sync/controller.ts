import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { BadRequestError, ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { DataDir } from "@keylearn/config";
import { Profile, ProfileData } from "@keylearn/database";
import { HighScoresFactory } from "@keylearn/highscores";
import { Logger } from "@keylearn/logger";
import { type NamedUser } from "@keylearn/pages-shared";
import { PublicId } from "@keylearn/publicid";
import { type Result } from "@keylearn/result";
import { parseMessage } from "@keylearn/result-io";
import { UserDataFactory } from "@keylearn/result-userdata";
import { File } from "@sosimple/fsx-file";
import { actorFor } from "../access/actor.ts";
import { type ProfileAction, reachProfile } from "../access/resolver.ts";
import { type AuthState, pProfileOwner } from "../auth/index.ts";
import { partitionPlausible } from "./plausible.ts";

/**
 * The documents a learner may keep on their account, and the ones the account
 * keeps for itself.
 *
 * An allow-list rather than a free namespace: these routes are reached with a
 * user's own credentials, and an open store would be an invitation to park
 * arbitrary data on someone else's disk.
 *
 * `local` is this device's browser storage, mirrored. A customer found that
 * nothing they set on one device appeared on another — not the theme, not the
 * accessibility settings, not the kids world, not a single preference — and
 * the reason was that each of those was written straight to localStorage by
 * whoever added it. There were about thirty-five such writes across twenty
 * files. Carrying them one endpoint at a time would have been thirty-five
 * decisions, each of which someone can forget to make, which is exactly the
 * mistake that produced the bug. So the mirror carries the storage itself, and
 * a new setting is portable because it is a setting, not because somebody
 * remembered.
 */
const PROFILE_DOCS: ReadonlySet<string> = new Set(["local"]);

const ACCOUNT_DOCS: ReadonlySet<string> = new Set(["local"]);

function requireDocName(name: string, allowed: ReadonlySet<string>): string {
  if (!allowed.has(name)) {
    throw new BadRequestError("Unknown document");
  }
  return name;
}

@injectable()
@controller()
export class Controller {
  constructor(
    readonly highScores: HighScoresFactory,
    readonly userData: UserDataFactory,
    readonly dataDir: DataDir,
  ) {}

  @http.GET("/_/sync/data/{id:[a-zA-Z0-9]+}")
  async getPublicData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pProfileOwner) profileOwner: NamedUser,
  ) {
    const { id } = profileOwner;
    await this.userData.load(PublicId.of(id)).serve(ctx);
  }

  @http.GET("/_/sync/data")
  async getData(ctx: Context<RouterState & AuthState>) {
    const { id } = ctx.state.requireUser();
    await this.userData.load(new PublicId(id!)).serve(ctx);
  }

  @http.POST("/_/sync/data")
  async postData(
    ctx: Context<RouterState & AuthState>,
    @body.binary(null, { maxLength: 1048576 }) value: Buffer,
  ) {
    const { id } = ctx.state.requireUser();
    const results = await parseResults(value);
    await this.userData.load(new PublicId(id!)).append(results);
    // Account-level history has no learner attached to it.
    await this.highScores.append(id!, null, creditable(results, id!));
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/data")
  async deleteData(ctx: Context<RouterState & AuthState>) {
    const { id } = ctx.state.requireUser();
    await this.userData.load(new PublicId(id!)).delete();
    // And the database snapshot, or "clear my statistics" would leave the
    // cleared history sitting in the backed-up copy.
    await ProfileData.deleteFor(id!, null, "results");
    ctx.response.status = 204;
  }

  // ---- Per-profile history (each learner's own results). ----

  @http.GET("/_/sync/data/profile/{pid:[0-9]+}")
  async getProfileData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      "read",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.userData.loadProfile(user.id!, profile.id!).serve(ctx);
  }

  @http.POST("/_/sync/data/profile/{pid:[0-9]+}")
  async postProfileData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @body.binary(null, { maxLength: 1048576 }) value: Buffer,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      "write",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    const results = await parseResults(value);
    await this.userData.loadProfile(user.id!, profile.id!).append(results);
    // Only grown-up profiles count toward the account's leaderboard; kids are
    // kept off the public high scores.
    if (profile.kind === "adult") {
      // Credited to the learner who typed it, not to the account holder.
      await this.highScores.append(
        user.id!,
        profile.id!,
        creditable(results, user.id!),
      );
    }
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/data/profile/{pid:[0-9]+}")
  async deleteProfileData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      "write",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.userData.loadProfile(user.id!, profile.id!).delete();
    await ProfileData.deleteFor(user.id!, profile.id!, "results");
    ctx.response.status = 204;
  }

  // ---- A separate course, kept beside the guided one --------------------
  //
  // Classic is its own course rather than a second face of the same lesson,
  // so it keeps its own results. The name is constrained to a short word by
  // the route pattern, which is also what keeps it from walking out of the
  // data directory once it becomes part of a file name.

  @http.GET("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]+}")
  async getCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
  ) {
    const profile = await this.#owned(ctx, pid, "read");
    await this.userData
      .loadProfile(ctx.state.requireUser().id!, profile.id!, course)
      .serve(ctx);
  }

  @http.POST("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]+}")
  async postCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
    @body.binary(null, { maxLength: 1048576 }) value: Buffer,
  ) {
    const user = ctx.state.requireUser();
    const profile = await this.#owned(ctx, pid, "write");
    const results = await parseResults(value);
    await this.userData
      .loadProfile(user.id!, profile.id!, this.#course(course))
      .append(results);
    // The board is one board. A course is a separate history, not a separate
    // leaderboard, so a fast run counts wherever it was typed.
    if (profile.kind === "adult") {
      await this.highScores.append(
        user.id!,
        profile.id!,
        creditable(results, user.id!),
      );
    }
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]+}")
  async deleteCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await this.#owned(ctx, pid, "write");
    await this.userData
      .loadProfile(user.id!, profile.id!, this.#course(course))
      .delete();
    ctx.response.status = 204;
  }

  /**
   * A course name that is safe to put in a file name.
   *
   * The route pattern already allows only lower-case letters, so nothing here
   * can walk out of the data directory; this bounds the length, which the
   * pattern cannot express — its own braces would be read as the router's.
   */
  #course(course: string): string {
    if (course.length > 16) {
      throw new BadRequestError("Unknown course");
    }
    return course;
  }

  /** The learner named in the path, once the resolver says the caller may reach them. */
  async #owned(
    ctx: Context<RouterState & AuthState>,
    pid: string,
    action: ProfileAction,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      action,
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    return profile;
  }

  // ---- Braille progress -------------------------------------------------
  //
  // Kept apart from the result sync above because it is not results: a braille
  // learner produces cells and chord times, never a lesson, and the binary
  // result format has nowhere to put them. Held on the device only until now,
  // so a learner moving to another machine — or a household reinstalling —
  // started again from the first five cells with no way to recover the rest.

  @http.GET("/_/sync/braille/profile/{pid:[0-9]+}")
  async getBrailleProgress(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    const file = await this.#brailleFile(ctx, pid, "read");
    ctx.response.type = "application/json";
    // An empty document rather than a 404: "this learner has done no braille
    // yet" is an ordinary answer, not an error, and the client would have to
    // special-case the status either way.
    ctx.response.body = (await file.exists()) ? await file.read("utf8") : "{}";
  }

  @http.POST("/_/sync/braille/profile/{pid:[0-9]+}")
  async postBrailleProgress(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    // Parsed by the framework, and re-serialised below rather than stored
    // verbatim — so whatever arrives, the file this serves back is JSON.
    @body.json(null, { maxLength: 262144 }) value: unknown,
  ) {
    const file = await this.#brailleFile(ctx, pid, "write");
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestError("Not a progress document");
    }
    await file.dir().create(true);
    await file.write(JSON.stringify(value), "utf8");
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/braille/profile/{pid:[0-9]+}")
  async deleteBrailleProgress(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    await (await this.#brailleFile(ctx, pid, "write")).delete();
    const user = ctx.state.requireUser();
    await ProfileData.deleteFor(user.id!, Number(pid), "braille");
    ctx.response.status = 204;
  }

  /** The file for this learner, once the caller is proved to own them. */
  // ── The learner's small documents ──────────────────────────────────
  //
  // One route for the state that kept being written straight to
  // localStorage because giving it an endpoint was more work than not: the
  // kids world's whole setup, a custom theme, streaks and best scores, test
  // history. Each was a device-local island, and a customer found every one
  // of them at once by opening the app on a second device.
  //
  // A fixed set of names rather than an open store. This is somebody's
  // account, not a key-value service, and an unbounded namespace is a place
  // to park arbitrary data at our expense.
  //
  // Documents, not merges: each is one learner's current answer, and the last
  // save wins. Braille progress keeps its own route below precisely because
  // it is NOT that — it is a record of real practice on both sides, and
  // merging is the whole point of it.

  @http.GET("/_/sync/doc/profile/{pid:[0-9]+}/{name:[a-z-]+}")
  async getProfileDoc(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("name") name: string,
  ) {
    const file = await this.#profileDoc(ctx, pid, name, "read");
    ctx.response.type = "application/json";
    ctx.response.body = (await file.exists()) ? await file.read("utf8") : "{}";
  }

  @http.POST("/_/sync/doc/profile/{pid:[0-9]+}/{name:[a-z-]+}")
  async postProfileDoc(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("name") name: string,
    @body.json(null, { maxLength: 262144 }) value: unknown,
  ) {
    const file = await this.#profileDoc(ctx, pid, name, "write");
    if (value == null || typeof value !== "object") {
      throw new BadRequestError("Not a document");
    }
    await file.dir().create(true);
    await file.write(JSON.stringify(value), "utf8");
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/doc/profile/{pid:[0-9]+}/{name:[a-z-]+}")
  async deleteProfileDoc(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("name") name: string,
  ) {
    await (await this.#profileDoc(ctx, pid, name, "write")).delete();
    ctx.response.status = 204;
  }

  @http.GET("/_/sync/doc/{name:[a-z-]+}")
  async getAccountDoc(
    ctx: Context<RouterState & AuthState>,
    @pathParam("name") name: string,
  ) {
    const user = ctx.state.requireUser();
    const file = new File(
      this.dataDir.accountDocFile(user.id!, requireDocName(name, ACCOUNT_DOCS)),
    );
    ctx.response.type = "application/json";
    ctx.response.body = (await file.exists()) ? await file.read("utf8") : "{}";
  }

  @http.POST("/_/sync/doc/{name:[a-z-]+}")
  async postAccountDoc(
    ctx: Context<RouterState & AuthState>,
    @pathParam("name") name: string,
    @body.json(null, { maxLength: 262144 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    if (value == null || typeof value !== "object") {
      throw new BadRequestError("Not a document");
    }
    const file = new File(
      this.dataDir.accountDocFile(user.id!, requireDocName(name, ACCOUNT_DOCS)),
    );
    await file.dir().create(true);
    await file.write(JSON.stringify(value), "utf8");
    ctx.response.status = 204;
  }

  async #profileDoc(
    ctx: Context<RouterState & AuthState>,
    pid: string,
    name: string,
    action: ProfileAction,
  ): Promise<File> {
    const safe = requireDocName(name, PROFILE_DOCS);
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      action,
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    return new File(this.dataDir.profileDocFile(user.id!, profile.id!, safe));
  }

  // ── A learner's accessibility preferences ──────────────────────────
  //
  // The same shape as the braille routes below, and for the same reason.
  // These settings decide whether the app is usable at all for the person
  // reading it — typeface, target size, motion, spacing, speech rate and
  // voice — and until now they lived in one browser's local storage. A
  // learner who needs them had to rebuild every one on every device.
  //
  // A document rather than a merge: unlike braille progress, which is a
  // record of real practice on both sides and must keep both, these are one
  // learner's current answer to "how should this look and sound". The last
  // save wins, and the client only pushes what the learner just changed.

  @http.GET("/_/sync/a11y/profile/{pid:[0-9]+}")
  async getA11yPrefs(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    const file = await this.#a11yFile(ctx, pid, "read");
    ctx.response.type = "application/json";
    // An empty document, not a 404: "this learner has set nothing yet" is an
    // ordinary answer, and it is what tells the client to offer its own local
    // copy up instead of taking defaults from an empty server.
    ctx.response.body = (await file.exists()) ? await file.read("utf8") : "{}";
  }

  @http.POST("/_/sync/a11y/profile/{pid:[0-9]+}")
  async postA11yPrefs(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    // Re-serialised rather than stored verbatim, so whatever arrives, what
    // this serves back is JSON. Small: a dozen scalar settings.
    @body.json(null, { maxLength: 8192 }) value: unknown,
  ) {
    const file = await this.#a11yFile(ctx, pid, "write");
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestError("Not a preferences document");
    }
    await file.dir().create(true);
    await file.write(JSON.stringify(value), "utf8");
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/a11y/profile/{pid:[0-9]+}")
  async deleteA11yPrefs(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
  ) {
    await (await this.#a11yFile(ctx, pid, "write")).delete();
    ctx.response.status = 204;
  }

  async #a11yFile(
    ctx: Context<RouterState & AuthState>,
    pid: string,
    action: ProfileAction,
  ): Promise<File> {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      action,
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    return new File(this.dataDir.a11yPrefsFile(user.id!, profile.id!));
  }

  async #brailleFile(
    ctx: Context<RouterState & AuthState>,
    pid: string,
    action: ProfileAction,
  ): Promise<File> {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      action,
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    return new File(this.dataDir.brailleProgressFile(user.id!, profile.id!));
  }
}

/**
 * The results fit to go on the leaderboard.
 *
 * Everything the client sends is kept in the learner's own history — it is
 * theirs, and inflating it only costs them their own unlocks. The board is
 * shared, so only what could physically have been typed reaches it. A refusal
 * is logged rather than silent: if a bound ever starts catching real people,
 * that has to be visible.
 */
function creditable(results: readonly Result[], userId: number): Result[] {
  const { credited, refused } = partitionPlausible(results);
  for (const { reason } of refused) {
    Logger.warn(
      "Implausible result from user [%d] not credited: %s",
      userId,
      reason,
    );
  }
  return credited;
}

// TODO Parse asynchronously in batches.
// TODO Convert to middleware.
async function parseResults(buffer: Buffer): Promise<Result[]> {
  const results = [];
  try {
    for (const result of parseMessage(buffer)) {
      if (result.validate()) {
        results.push(result);
      }
    }
  } catch (err: any) {
    throw new BadRequestError(err.message);
  }
  return results;
}
