import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  AuthThrottle,
  generateTotpSecret,
  type User,
  UserLoginRequest,
} from "@keylearn/database";
import { UserDataFactory } from "@keylearn/result-userdata";
import { equal, isFalse, isNull, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { resetRateLimits } from "./ratelimit.ts";
import { encryptTotpSecret } from "./totp-crypto.ts";

/**
 * The pre-release login hardening: every sign-in honours two-step
 * verification, guesses are counted per account rather than per IP, the
 * lookup route stops describing accounts, and the sensitive account routes
 * ask for proof a live session alone cannot give.
 */

const context = new TestContext();

const PASSWORD = "correct horse battery staple";

function hashed(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function totp(secret: string, at: number = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "")) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

/** Turns two-step on for a seeded account, returning the plain secret. */
async function withTwoFactor(user: User): Promise<string> {
  const secret = generateTotpSecret();
  await user.$query().patch({
    totpSecret: encryptTotpSecret(
      secret,
      context.get(UserDataFactory).dataDir.dataPath(),
    ),
    totpEnabled: true,
    totpLastStep: null,
    emailVerified: true,
  });
  return secret;
}

test("a magic link to a two-step account parks the session until the code", async () => {
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  const secret = await withTwoFactor(user);
  await UserLoginRequest.query().insertGraph({
    email: user.email!,
    purpose: "login",
    accessToken: hashed("magic"),
    createdAt: new Date(),
  } as UserLoginRequest);
  const request = startApp(context.get(Application, kMain));

  const response = await request.GET("/login/magic").send();
  equal(response.status, 302);
  equal(response.headers.get("Location"), "/login?sso=twofactor");
  // The inbox alone opens nothing.
  isNull(await request.who());

  const verified = await request
    .POST("/auth/2fa/verify")
    .send({ code: totp(secret) });
  equal(verified.status, 200);
  equal(await request.who(), user.email);
});

test("a password reset does not skip two-step verification", async () => {
  resetRateLimits();
  const user = await findUser("user2@keylearn.org");
  await withTwoFactor(user);
  await UserLoginRequest.query().insertGraph({
    email: user.email!,
    purpose: "reset",
    accessToken: hashed("reset-token"),
    createdAt: new Date(),
  } as UserLoginRequest);
  const request = startApp(context.get(Application, kMain));

  const response = await request
    .POST("/auth/reset-password")
    .send({ token: "reset-token", password: "a brand new passphrase 9" });
  equal(response.status, 200);
  equal((await response.body.json<{ twoFactor?: boolean }>()).twoFactor, true);
  isNull(await request.who());
});

test("an authenticator code cannot be spent twice", async () => {
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  await user.setPassword(PASSWORD);
  const secret = await withTwoFactor(user);
  const code = totp(secret);

  const first = startApp(context.get(Application, kMain));
  await first
    .POST("/auth/login-password")
    .send({ email: user.email, password: PASSWORD });
  equal((await first.POST("/auth/2fa/verify").send({ code })).status, 200);

  // Somebody who watched the code typed tries it inside its 90 s life.
  const second = startApp(context.get(Application, kMain));
  await second
    .POST("/auth/login-password")
    .send({ email: user.email, password: PASSWORD });
  equal((await second.POST("/auth/2fa/verify").send({ code })).status, 403);
  isNull(await second.who());
});

test("wrong passwords lock the address, whatever IP they come from", async () => {
  const user = await findUser("user3@keylearn.org");
  await user.setPassword(PASSWORD);
  await user.$query().patch({ emailVerified: true });
  const request = startApp(context.get(Application, kMain));
  for (let i = 0; i < 10; i++) {
    // A fresh per-IP budget each time — the shape of a distributed attack.
    resetRateLimits();
    const wrong = await request
      .POST("/auth/login-password")
      .send({ email: user.email, password: `guess number ${i}` });
    equal(wrong.status, 403);
  }
  resetRateLimits();
  // Now even the right password is refused, with the same generic answer.
  const right = await request
    .POST("/auth/login-password")
    .send({ email: user.email, password: PASSWORD });
  equal(right.status, 403);
  isNull(await request.who());
  isTrue(
    (await AuthThrottle.lockedFor(
      "password",
      AuthThrottle.forEmail(user.email!),
    )) > 0,
  );
});

test("lookup no longer reports two-step, and unknown addresses look the same", async () => {
  resetRateLimits();
  const request = startApp(context.get(Application, kMain));
  const known = await request
    .POST("/auth/lookup")
    .send({ email: "user1@keylearn.org" });
  equal(known.status, 200);
  const body = await known.body.json<Record<string, unknown>>();
  isFalse("twoFactor" in body);

  const unknown = await request
    .POST("/auth/lookup")
    .send({ email: "nobody@keylearn.org" });
  const shape = await unknown.body.json<Record<string, unknown>>();
  equal(Object.keys(shape).sort().join(","), "exists,hasPassword,providers");
  equal(shape["exists"], false);
});

test("lookup is limited per address, not only per client", async () => {
  const request = startApp(context.get(Application, kMain));
  for (let i = 0; i < 10; i++) {
    resetRateLimits();
    const ok = await request
      .POST("/auth/lookup")
      .send({ email: "user2@keylearn.org" });
    equal(ok.status, 200);
  }
  resetRateLimits();
  const refused = await request
    .POST("/auth/lookup")
    .send({ email: "user2@keylearn.org" });
  equal(refused.status, 429);
});

test("adding a passkey needs a recent sign-in", async () => {
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  await user.setPassword(PASSWORD);
  const request = startApp(context.get(Application, kMain));
  // `become` makes a session with no sign-in time: an old session.
  await request.become(user.id!);
  const stale = await request.POST("/auth/passkey/register-options").send({});
  equal(stale.status, 403);
  equal(
    (await stale.body.json<{ error: { reauth?: boolean } }>()).error.reauth,
    true,
  );

  const wrong = await request.POST("/auth/reauth").send({ password: "not it" });
  equal(wrong.status, 403);
  const right = await request.POST("/auth/reauth").send({ password: PASSWORD });
  equal(right.status, 200);
  const options = await request.POST("/auth/passkey/register-options").send({});
  equal(options.status, 200);
});

test("export and patch-account sit behind the grown-up PIN", async () => {
  resetRateLimits();
  const user = await findUser("user2@keylearn.org");
  await user.setParentPin("8317");
  try {
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);
    equal((await request.GET("/_/account/export").send()).status, 428);
    equal(
      (await request.PATCH("/_/account").send({ publicProfile: true })).status,
      428,
    );
    equal(
      (await request.POST("/auth/passkey/register-options").send({})).status,
      428,
    );
    const proved = await request
      .POST("/_/account/parent-pin/verify")
      .send({ pin: "8317" });
    equal(proved.status, 200);
    equal((await request.GET("/_/account/export").send()).status, 200);
  } finally {
    await user.setParentPin(null);
  }
});

test("wrong PINs lock the account, whatever IP they come from", async () => {
  const user = await findUser("user3@keylearn.org");
  await user.setParentPin("8317");
  try {
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);
    for (let i = 0; i < 10; i++) {
      resetRateLimits();
      const wrong = await request
        .POST("/_/account/parent-pin/verify")
        .send({ pin: String(1000 + i) });
      equal(wrong.status, 403);
    }
    resetRateLimits();
    const right = await request
      .POST("/_/account/parent-pin/verify")
      .send({ pin: "8317" });
    equal(right.status, 403);
  } finally {
    await user.setParentPin(null);
  }
});
