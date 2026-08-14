import { controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { injectable } from "@fastr/invert";
import { type NamedUser } from "@keylearn/pages-shared";
import { pProfileOwner } from "../auth/index.ts";

@injectable()
@controller()
export class Controller {
  constructor() {}

  @http.GET("/_/profile/{id:[a-zA-Z0-9]+}")
  async getProfile(
    ctx: Context,
    @pathParam("id", pProfileOwner) profileOwner: NamedUser,
  ) {
    // Whoever set this profile public shared their typing history, not
    // whether their account happens to be staff — that isn't this public
    // surface's business to disclose about them.
    const { staff: _staff, ...rest } = profileOwner;
    ctx.response.body = rest;
  }
}
