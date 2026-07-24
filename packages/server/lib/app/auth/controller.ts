import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import {
  ApplicationError,
  BadRequestError,
  ForbiddenError,
} from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { randomString, type SessionState } from "@fastr/middleware-session";
import { User, UserExistsError, UserLoginRequest } from "@keybr/database";
import { Logger } from "@keybr/logger";
import { type AbstractAdapter } from "@keybr/oauth";
import { z } from "zod";
import { Mailer } from "../mail/index.ts";
import { messageWithLink, messageWithResetLink } from "./email.ts";
import { pAdapter } from "./pipe.ts";
import { type AuthState } from "./types.ts";
import { zod } from "./zod.ts";

const jsonOpts = { maxLength: 4096 };

const MIN_PASSWORD = 8;

const TCreateToken = z.object({
  email: z.string().min(1).email(),
});
type TCreateToken = z.infer<typeof TCreateToken>;
const PCreateToken = zod(TCreateToken, () => {
  throw new ApplicationError("Invalid e-mail address");
});

const TRegister = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(MIN_PASSWORD).max(128),
  name: z.string().max(32).optional(),
});
type TRegister = z.infer<typeof TRegister>;
const PRegister = zod(TRegister, () => {
  throw new ApplicationError(
    `Enter a valid email and a password of at least ${MIN_PASSWORD} characters`,
  );
});

const TLogin = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1).max(128),
});
type TLogin = z.infer<typeof TLogin>;
const PLogin = zod(TLogin, () => {
  throw new ApplicationError("Invalid email or password");
});

const TForgot = z.object({
  email: z.string().min(1).email(),
});
type TForgot = z.infer<typeof TForgot>;
const PForgot = zod(TForgot, () => {
  throw new ApplicationError("Invalid e-mail address");
});

const TReset = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD).max(128),
});
type TReset = z.infer<typeof TReset>;
const PReset = zod(TReset, () => {
  throw new ApplicationError(
    `Password must be at least ${MIN_PASSWORD} characters`,
  );
});

const TPatchAccount = z.object({
  anonymized: z.boolean(),
});
type TPatchAccount = z.infer<typeof TPatchAccount>;
const PPatchAccount = zod(TPatchAccount, () => {
  throw new ApplicationError("Invalid request");
});

@injectable()
@controller()
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
  ) {}

  @http.GET({ name: "oauth-init", path: "/auth/oauth-init/{adapter}" })
  async oAuthInit(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("adapter", pAdapter) adapter: AbstractAdapter,
  ) {
    const state = randomString(20);
    ctx.state.session.start();
    ctx.state.session.set("authState", state);
    ctx.response.redirect(adapter.getAuthorizationUrl({ state }));
  }

  @http.GET({ name: "oauth-callback", path: "/auth/oauth-callback/{adapter}" })
  async oAuthCallback(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("adapter", pAdapter) adapter: AbstractAdapter,
    @queryParam("code", zod(z.string().min(1))) code: string,
    @queryParam("state", zod(z.string().min(1))) state: string,
  ) {
    const authState = ctx.state.session.pull("authState");
    ctx.state.session.destroy();
    if (state === authState) {
      const token = await adapter.getAccessToken({ code });
      const resourceOwner = await adapter.getProfile(token);
      if (resourceOwner.email != null) {
        const user = await User.ensure(resourceOwner);
        ctx.state.session.start();
        ctx.state.session.set("userId", user.id!);
      }
      ctx.response.redirect("/");
    } else {
      throw new BadRequestError();
    }
  }

  @http.POST({ name: "create-token", path: "/auth/login/register-email" })
  async createToken(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PCreateToken, jsonOpts) { email }: TCreateToken,
  ) {
    const token = String(await UserLoginRequest.init(email));
    const link = String(
      new URL(ctx.state.router.makePath("login", { token }), this.canonicalUrl),
    );
    try {
      await this.mailer.sendMail(messageWithLink({ email, link }));
    } catch (err: any) {
      Logger.warn(err, "Error sending e-mail message to '%s'", email);
      throw new ApplicationError("Error sending e-mail message");
    }
    ctx.response.body = { email };
  }

  @http.POST({ name: "register-password", path: "/auth/register-password" })
  async registerWithPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PRegister, jsonOpts) { email, password, name }: TRegister,
  ) {
    ctx.state.session.destroy();
    let user;
    try {
      user = await User.registerWithPassword(email, password, name ?? "");
    } catch (err) {
      if (err instanceof UserExistsError) {
        throw new ApplicationError(
          "An account with this email already exists. Try logging in instead.",
        );
      }
      throw err;
    }
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "login-password", path: "/auth/login-password" })
  async loginWithPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PLogin, jsonOpts) { email, password }: TLogin,
  ) {
    const user = await User.loginWithPassword(email, password);
    if (user == null) {
      // One message for both cases — never reveal whether the email exists.
      throw new ForbiddenError("Invalid email or password");
    }
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "forgot-password", path: "/auth/forgot-password" })
  async forgotPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PForgot, jsonOpts) { email }: TForgot,
  ) {
    // Only send a link to accounts that actually exist, but always answer the
    // same way so the endpoint can't be used to probe for registered emails.
    const user = await User.findByEmail(email);
    if (user != null) {
      const token = String(await UserLoginRequest.init(email));
      const link = String(
        new URL(`/reset-password/${token}`, this.canonicalUrl),
      );
      try {
        await this.mailer.sendMail(messageWithResetLink({ email, link }));
      } catch (err: any) {
        Logger.warn(err, "Error sending reset e-mail to '%s'", email);
      }
    }
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "reset-password", path: "/auth/reset-password" })
  async resetPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PReset, jsonOpts) { token, password }: TReset,
  ) {
    const email = await UserLoginRequest.consume(token);
    if (email == null) {
      throw new ForbiddenError("This reset link has expired or is invalid");
    }
    const user = await User.findByEmail(email);
    if (user == null) {
      throw new ForbiddenError("This reset link has expired or is invalid");
    }
    await user.setPassword(password);
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.response.body = { ok: true };
  }

  @http.GET({ name: "login", path: "/login/{token}" })
  async loginWithToken(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("token", zod(z.string().min(1))) token: string,
  ) {
    ctx.state.session.destroy();
    const user = await UserLoginRequest.login(token);
    if (user != null) {
      ctx.state.session.start();
      ctx.state.session.set("userId", user.id!);
      ctx.response.redirect("/");
    } else {
      throw new ForbiddenError("Invalid login link", {
        description:
          "The login link that you are currently using is either expired or invalid. " +
          "Please enter your e-mail address again to receive a new login link. " +
          "Don’t worry, your account is safe! " +
          "You likely got here because you used an old link that does not work anymore.",
      });
    }
  }

  @http.GET({ name: "logout", path: "/auth/logout" })
  async logout(ctx: Context<RouterState & SessionState & AuthState>) {
    ctx.state.session.destroy();
    ctx.response.redirect("/");
  }

  @http.PATCH({ name: "patch-account", path: "/_/account" })
  async patchAccount(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PPatchAccount, jsonOpts) { anonymized }: TPatchAccount,
  ) {
    const user = ctx.state.requireUser();
    await user.$query().patch({ anonymized: Number(anonymized) });
    const result = await User.findById(user.id!);
    if (result == null) {
      throw new ForbiddenError();
    }
    ctx.response.body = {
      user: result.toDetails(),
      publicUser: User.toPublicUser(result, 0),
    };
  }

  @http.DELETE({ name: "delete-account", path: "/_/account" })
  async deleteAccount(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    await user.$query().delete();
    ctx.state.session.destroy();
    ctx.response.status = 204;
  }
}
