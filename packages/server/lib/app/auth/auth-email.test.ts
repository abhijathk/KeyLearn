import { createHash } from "node:crypto";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { User, UserLoginRequest } from "@keylearn/database";
import { load } from "cheerio";
import { deepEqual, equal, isNotNull, isNull, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

const context = new TestContext();

/**
 * Sign-in links are stored as a SHA-256 hash, never in the clear, so a database
 * read yields nothing anybody can sign in with. These tests seed the hash and
 * send the plaintext, which is the way the real flow works.
 */
function hashed(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token out of the sign-in link in an email. */
function tokenFromLink(text: string): string {
  const match = /\/login\/(\S+)/.exec(text);
  isNotNull(match);
  return match![1];
}

test("send a new access token", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request //
    .POST("/auth/login/register-email")
    .send({
      email: "test@keylearn.com",
    });

  // Assert.

  equal(response.status, 200);
  equal(
    response.headers.get("Content-Type"),
    "application/json; charset=UTF-8",
  );
  deepEqual(await response.body.json(), {
    email: "test@keylearn.com",
  });

  isNull(await request.who());

  const userLoginRequest =
    await UserLoginRequest.findByEmail("test@keylearn.com");
  isNotNull(userLoginRequest);

  const user = await User.findByEmail("test@keylearn.com");
  isNull(user);

  const [message] = context.mailer.dump();
  equal(message.to, "test@keylearn.com");
  // The link carries the plaintext token; the row carries only its hash.
  const token = tokenFromLink(message.text!);
  equal(userLoginRequest!.accessToken, hashed(token));
  isTrue(!message.text!.includes(userLoginRequest!.accessToken!));
});

test("send an existing access token", async () => {
  // Arrange.

  await UserLoginRequest.query().insertGraph({
    email: "test@keylearn.com",
    accessToken: hashed("xyz"),
    createdAt: new Date(),
  } as UserLoginRequest);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request //
    .POST("/auth/login/register-email")
    .send({
      email: "test@keylearn.com",
    });

  // Assert.

  equal(response.status, 200);
  equal(
    response.headers.get("Content-Type"),
    "application/json; charset=UTF-8",
  );
  deepEqual(await response.body.json(), {
    email: "test@keylearn.com",
  });

  isNull(await request.who());

  const userLoginRequest =
    await UserLoginRequest.findByEmail("test@keylearn.com");
  isNotNull(userLoginRequest);

  const user = await User.findByEmail("test@keylearn.com");
  isNull(user);

  const [message] = context.mailer.dump();
  equal(message.to, "test@keylearn.com");
  const token = tokenFromLink(message.text!);
  equal(userLoginRequest!.accessToken, hashed(token));
  // Asking again replaces the outstanding token rather than mailing the old
  // one a second time, so the superseded link stops working.
  isTrue(token !== "xyz");
});

test("login with an access token / new user", async () => {
  // Arrange.

  await UserLoginRequest.query().insertGraph({
    email: "test@keylearn.com",
    accessToken: hashed("xyz"),
    createdAt: new Date(),
  } as UserLoginRequest);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/login/xyz").send();

  // Assert.

  equal(response.status, 302);
  equal(response.headers.get("Location"), "/");

  // One shot: redeeming the link consumes it, so the same link in a forwarded
  // email or a browser history is no longer a way in.
  isNull(await UserLoginRequest.findByEmail("test@keylearn.com"));

  const user = await User.findByEmail("test@keylearn.com");
  isNotNull(user);

  equal(await request.who(), "test@keylearn.com");

  deepEqual(context.mailer.dump(), []);
});

test("login with an access token / existing user", async () => {
  // Arrange.

  await User.query().insertGraph({
    email: "test@keylearn.com",
    name: "test",
    createdAt: new Date(),
  } as User);

  await UserLoginRequest.query().insertGraph({
    email: "test@keylearn.com",
    accessToken: hashed("xyz"),
    createdAt: new Date(),
  } as UserLoginRequest);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/login/xyz").send();

  // Assert.

  equal(response.status, 302);
  equal(response.headers.get("Location"), "/");

  isNull(await UserLoginRequest.findByEmail("test@keylearn.com"));

  const user = await User.findByEmail("test@keylearn.com");
  isNotNull(user);

  equal(await request.who(), "test@keylearn.com");

  deepEqual(context.mailer.dump(), []);
});

test("reject a token stolen from the database", async () => {
  // Arrange.

  // What a reader of the table actually has is the hash. Presenting it must not
  // sign anybody in — that is the whole point of storing the hash.
  const stored = hashed("xyz");
  await UserLoginRequest.query().insertGraph({
    email: "test@keylearn.com",
    accessToken: stored,
    createdAt: new Date(),
  } as UserLoginRequest);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET(`/login/${stored}`).send();

  // Assert.

  equal(response.status, 403);
  isNull(await request.who());
  isNull(await User.findByEmail("test@keylearn.com"));
});

test("ignore invalid access token", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/login/xyz").send();

  // Assert.

  equal(response.status, 403);

  const $ = load(await response.body.text());
  isTrue($("body").text().includes("Invalid login link"));

  isNull(await request.who());

  deepEqual(context.mailer.dump(), []);
});
