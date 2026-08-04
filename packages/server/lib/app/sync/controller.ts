import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { BadRequestError, ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { DataDir } from "@keylearn/config";
import { Profile } from "@keylearn/database";
import { HighScoresFactory } from "@keylearn/highscores";
import { type NamedUser } from "@keylearn/pages-shared";
import { PublicId } from "@keylearn/publicid";
import { type Result } from "@keylearn/result";
import { parseMessage } from "@keylearn/result-io";
import { UserDataFactory } from "@keylearn/result-userdata";
import { File } from "@sosimple/fsx-file";
import { type AuthState, pProfileOwner } from "../auth/index.ts";

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
    await this.highScores.append(id!, null, results);
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/data")
  async deleteData(ctx: Context<RouterState & AuthState>) {
    const { id } = ctx.state.requireUser();
    await this.userData.load(new PublicId(id!)).delete();
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
      await this.highScores.append(user.id!, profile.id!, results);
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
    ctx.response.status = 204;
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
