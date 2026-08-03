import { type Context } from "@fastr/core";
import { NotFoundError } from "@fastr/errors";
import { type RouterState } from "@fastr/middleware-router";
import { User } from "@keylearn/database";
import { type AbstractAdapter } from "@keylearn/oauth";
import { type NamedUser } from "@keylearn/pages-shared";
import { PublicId } from "@keylearn/publicid";
import { AdapterFactory } from "./module.ts";
import { type AuthState } from "./types.ts";

export const pAdapter = (
  ctx: Context<RouterState>,
  value: string,
): AbstractAdapter => {
  const { container } = ctx;
  const redirectUri = ctx.state.router.makePath("oauth-callback", {
    adapter: value,
  });
  if (container.has(AdapterFactory, value)) {
    return container.get(AdapterFactory, value).makeAdapter(redirectUri);
  }
  throw new NotFoundError();
};

/**
 * Resolves a public profile id to its owner.
 *
 * A public id is a reversible encoding of the account's row id, not a secret, so
 * anyone can walk the whole range. The account must therefore have opted in to
 * being publicly viewable — otherwise this reports "not found", the same answer
 * as an id that does not exist, so the endpoint cannot be used to enumerate who
 * has an account either.
 *
 * The owner viewing their own profile is always allowed.
 */
export const pProfileOwner = async (
  ctx: Context<RouterState & Partial<AuthState>>,
  value: string,
): Promise<NamedUser> => {
  const publicId = PublicId.parse(value);
  if (publicId != null) {
    const user = publicId.example ? null : await User.findById(publicId.id);
    const isOwner = user != null && ctx.state.user?.id === user.id;
    if (publicId.example || isOwner || Boolean(user?.publicProfile)) {
      const profileOwner = await User.loadProfileOwner(publicId);
      if (profileOwner != null) {
        return profileOwner;
      }
    }
  }
  throw new NotFoundError();
};
