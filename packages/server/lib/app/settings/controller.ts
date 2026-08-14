import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { Profile } from "@keylearn/database";
import { Settings } from "@keylearn/settings";
import { SettingsDatabase } from "@keylearn/settings-database";
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
    await this.database.set(user.id!, new Settings(value as any));
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
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    ctx.response.body =
      (await this.database.getProfile(user.id!, Number(id)))?.toJSON() ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/profile-settings/{id:[0-9]+}")
  async putProfileSettings(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id") id: string,
    @body.json(null, { maxLength: 65536 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.database.setProfile(
      user.id!,
      Number(id),
      new Settings(value as any),
    );
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/profile-settings/{id:[0-9]+}")
  async deleteProfileSettings(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id") id: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.database.setProfile(user.id!, Number(id), null);
    ctx.response.status = 204;
  }
}
