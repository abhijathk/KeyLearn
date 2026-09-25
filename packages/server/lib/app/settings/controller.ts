import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { BadRequestError, ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { Profile } from "@keylearn/database";
import { Settings } from "@keylearn/settings";
import { SettingsDatabase } from "@keylearn/settings-database";
import { actorFor } from "../access/actor.ts";
import { learnerOwner } from "../access/owner.ts";
import { reachProfile } from "../access/resolver.ts";
import { type AuthState } from "../auth/index.ts";

@injectable()
@controller()
export class Controller {
  constructor(readonly database: SettingsDatabase) {}

  @http.GET("/_/sync/settings")
  async getSettings(ctx: Context<RouterState & AuthState>) {
    const user = ctx.state.requireUser();
    ctx.response.body = (await this.database.get(user.id!))?.toJSON() ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/settings")
  async putSettings(
    ctx: Context<RouterState & AuthState>,
    @body.json(null, { maxLength: 65536 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    await this.database.set(user.id!, toSettings(value));
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/settings")
  async deleteSettings(ctx: Context<RouterState & AuthState>) {
    const user = ctx.state.requireUser();
    await this.database.set(user.id!, null);
    ctx.response.status = 204;
  }

  @http.GET("/_/sync/profile-settings/{id:[0-9]+}")
  async getProfileSettings(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id") id: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(actorFor(ctx, user), Number(id), "read");
    if (profile == null) {
      throw new ForbiddenError();
    }
    // The owner's copy: a teacher on a guardian's grant reads the learner's
    // settings, not an empty file of their own.
    ctx.response.body =
      (
        await this.database.getProfile(
          learnerOwner(profile) ?? user.id!,
          Number(id),
        )
      )?.toJSON() ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/profile-settings/{id:[0-9]+}")
  async putProfileSettings(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id") id: string,
    @body.json(null, { maxLength: 65536 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(id),
      "write",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.database.setProfile(
      learnerOwner(profile) ?? user.id!,
      Number(id),
      toSettings(value),
    );
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/profile-settings/{id:[0-9]+}")
  async deleteProfileSettings(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id") id: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(id),
      "write",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.database.setProfile(
      learnerOwner(profile) ?? user.id!,
      Number(id),
      null,
    );
    ctx.response.status = 204;
  }
}

/** A settings document is a JSON object; anything else is the caller's error, not a 500. */
function toSettings(value: unknown): Settings {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("Not a settings document");
  }
  return new Settings(value as any);
}
