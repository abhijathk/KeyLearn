import { test } from "node:test";
import { equal, isNotNull, isNull } from "rich-assert";
import { User, UserLoginRequest } from "./model.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

const email = "user@keybr.com";

test("a sign-in link cannot be redeemed as a password reset", async () => {
  const token = await UserLoginRequest.init(email, "login");

  // A "here is your sign-in link" email is something a user may forward or
  // paste somewhere. It must not also authorise setting a new password.
  isNull(await UserLoginRequest.consume(token));

  // Still valid for what it was issued for.
  isNotNull(await UserLoginRequest.login(token));
});

test("a password reset link cannot be redeemed as a sign-in", async () => {
  await User.query().insertGraph({ email, name: "user" });
  const token = await UserLoginRequest.init(email, "reset");

  isNull(await UserLoginRequest.login(token));
  equal(await UserLoginRequest.consume(token), email);
});

test("links of both purposes coexist for one address", async () => {
  await User.query().insertGraph({ email, name: "user" });
  const login = await UserLoginRequest.init(email, "login");
  const reset = await UserLoginRequest.init(email, "reset");

  // Issuing the second must not have replaced the first.
  equal(await UserLoginRequest.consume(reset), email);
  isNotNull(await UserLoginRequest.login(login));
});

test("a redeemed link cannot be replayed", async () => {
  await User.query().insertGraph({ email, name: "user" });
  const token = await UserLoginRequest.init(email, "reset");
  equal(await UserLoginRequest.consume(token), email);
  isNull(await UserLoginRequest.consume(token));
});

test("a reset link expires sooner than a sign-in link", async () => {
  equal(UserLoginRequest.expireTimeFor("reset"), 60 * 60 * 1000);
  equal(UserLoginRequest.expireTimeFor("login"), 24 * 3600 * 1000);

  await User.query().insertGraph({ email, name: "user" });
  const token = await UserLoginRequest.init(email, "reset");
  const row = await UserLoginRequest.findByEmail(email);
  // Age it past the reset lifetime but well inside the login one.
  await row!.$query().patch({
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });
  isNull(await UserLoginRequest.consume(token));
});
