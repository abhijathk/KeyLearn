import { test } from "node:test";
import { type Context } from "@fastr/core";
import { isFalse, isTrue } from "rich-assert";
import { isDeskRequest } from "./desk-session.ts";

/**
 * Which cookie a request gets is a security boundary, and it was wrong in
 * a way nothing caught: `/_/support` covered the customer's own account
 * section as well as the staff desk, so the grown-up PIN was proved into
 * one session and read back from the other.
 */

const req = (path: string, deskHeader = false, method = "GET"): Context =>
  ({
    request: {
      path,
      method,
      headers: { get: () => (deskHeader ? "1" : null) },
    },
  }) as unknown as Context;

test("the customer's own support routes use the app session", () => {
  // These are the account holder's, and the PIN they prove lives in the
  // app session because the verify route is /_/account/parent-pin/verify.
  for (const path of [
    "/_/support/my/tickets",
    "/_/support/my/tickets/12",
    "/_/support/my/tickets/12/reply",
    "/_/support/my/attachments",
    "/_/support/my/attachments/3",
    "/_/support/my/draft",
    "/_/support/my/me",
    "/_/support/gate",
    "/_/support/t/some-token",
    "/_/support/t/some-token/reply",
  ]) {
    isFalse(isDeskRequest(req(path)), path);
  }
});

test("filing a ticket is the customer; listing them is the desk", () => {
  // Same path, opposite sides. Read from the wrong session, the gate sees
  // no user and lets a ticket through ungated.
  isFalse(isDeskRequest(req("/_/support/tickets", false, "POST")));
  isTrue(isDeskRequest(req("/_/support/tickets", false, "GET")));
  isTrue(isDeskRequest(req("/_/support/tickets/12", false, "POST")));
});

test("the staff desk still gets its own session", () => {
  for (const path of [
    "/desk",
    "/desk/inbox",
    "/_/support/desk/dashboard",
    "/_/support/tickets/12",
    "/_/support/tickets/12/reply",
    "/_/support/accounts",
    "/_/support/accounts/7/reveal-email",
  ]) {
    isTrue(isDeskRequest(req(path)), path);
  }
});

test("a path that merely starts with the same letters is not carved out", () => {
  // "/_/support/mystery" must not be mistaken for "/_/support/my".
  isTrue(isDeskRequest(req("/_/support/mystery")));
  isTrue(isDeskRequest(req("/_/support/gateway")));
});

test("the explicit desk header still wins outside both prefixes", () => {
  isTrue(isDeskRequest(req("/auth/signin", true)));
  isFalse(isDeskRequest(req("/auth/signin")));
});

test("the carve-out beats the header, so the header cannot steal the account section", () => {
  isFalse(isDeskRequest(req("/_/support/my/tickets", true)));
});
