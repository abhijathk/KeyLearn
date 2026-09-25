import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { EmailVerification, User } from "@keylearn/database";
import { equal, isFalse, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { resetRateLimits } from "./ratelimit.ts";

/**
 * Turning on two-step verification asks who is doing it. A second factor
 * enrolled by whoever holds a stolen session belongs to them, and locks the
 * owner out at their next sign-in — so a live session alone is not enough:
 * the password, or for an account without one a code emailed to it.
 */

const context = new TestContext();

function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "")) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

async function begin(userId: number) {
  resetRateLimits();
  const request = startApp(context.get(Application, kMain));
  await request.become(userId);
  const started = await request.POST("/_/account/2fa/begin").send({});
  const { secret } = await started.body.json<{ secret: string }>();
  return { request, secret };
}

async function enabled(userId: number): Promise<boolean> {
  return Boolean((await User.findById(userId))!.totpEnabled);
}

test("a password account must give its password to turn it on", async () => {
  const user = await findUser("user1@keylearn.org");
  await user.setPassword("correct horse battery staple");
  const { request, secret } = await begin(user.id!);

  const bare = await request
    .POST("/_/account/2fa/enable")
    .send({ code: totp(secret) });
  equal(bare.status, 403);
  isFalse(await enabled(user.id!));

  const wrong = await request
    .POST("/_/account/2fa/enable")
    .send({ code: totp(secret), password: "not the password" });
  equal(wrong.status, 403);
  isFalse(await enabled(user.id!));

  const right = await request.POST("/_/account/2fa/enable").send({
    code: totp(secret),
    password: "correct horse battery staple",
  });
  equal(right.status, 200);
  isTrue(await enabled(user.id!));
});

test("an account without a password proves itself with an emailed code", async () => {
  const user = await findUser("user2@keylearn.org");
  isTrue(user.passwordHash == null);
  const { request, secret } = await begin(user.id!);

  const bare = await request
    .POST("/_/account/2fa/enable")
    .send({ code: totp(secret) });
  equal(bare.status, 403);
  isFalse(await enabled(user.id!));

  // The code goes to the account's own address, under the identity purpose.
  const sent = await request.POST("/auth/change-email/identity-code").send({});
  equal(sent.status, 200);
  const row = await EmailVerification.query().findOne({
    email: user.email!,
    purpose: "identity",
  });
  isTrue(row != null);
  // Only the hash is stored; pin a known code to the issued row.
  await row!.$query().patch({
    codeHash: createHash("sha256").update("246810").digest("hex"),
    createdAt: new Date(),
  });

  const wrong = await request
    .POST("/_/account/2fa/enable")
    .send({ code: totp(secret), identityCode: "000000" });
  equal(wrong.status, 403);
  isFalse(await enabled(user.id!));

  const right = await request
    .POST("/_/account/2fa/enable")
    .send({ code: totp(secret), identityCode: "246810" });
  equal(right.status, 200);
  isTrue(await enabled(user.id!));
});
