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
import { type AuthState, pProfileOwner } from "../auth/index.ts";
import { partitionPlausible } from "./plausible.ts";

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
    const profile = await Profile.findOwned(user.id!, Number(pid));
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
    const profile = await Profile.findOwned(user.id!, Number(pid));
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
    const profile = await Profile.findOwned(user.id!, Number(pid));
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

  @http.GET("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]{1,16}}")
  async getCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
  ) {
    const profile = await this.#owned(ctx, pid);
    await this.userData
      .loadProfile(ctx.state.requireUser().id!, profile.id!, course)
      .serve(ctx);
  }

  @http.POST("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]{1,16}}")
  async postCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
    @body.binary(null, { maxLength: 1048576 }) value: Buffer,
  ) {
    const user = ctx.state.requireUser();
    const profile = await this.#owned(ctx, pid);
    const results = await parseResults(value);
    await this.userData
      .loadProfile(user.id!, profile.id!, course)
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

  @http.DELETE("/_/sync/data/profile/{pid:[0-9]+}/{course:[a-z]{1,16}}")
  async deleteCourseData(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @pathParam("course") course: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await this.#owned(ctx, pid);
    await this.userData.loadProfile(user.id!, profile.id!, course).delete();
    ctx.response.status = 204;
  }

  /** The learner named in the path, once the caller is proved to own them. */
  async #owned(ctx: Context<RouterState & AuthState>, pid: string) {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(pid));
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
    const file = await this.#brailleFile(ctx, pid);
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
    const file = await this.#brailleFile(ctx, pid);
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
    await (await this.#brailleFile(ctx, pid)).delete();
    const user = ctx.state.requireUser();
    await ProfileData.deleteFor(user.id!, Number(pid), "braille");
    ctx.response.status = 204;
  }

  /** The file for this learner, once the caller is proved to own them. */
  async #brailleFile(
    ctx: Context<RouterState & AuthState>,
    pid: string,
  ): Promise<File> {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(pid));
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
