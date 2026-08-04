import { test } from "node:test";
import { isFalse, isTrue } from "rich-assert";
import { allowWebSocketOrigin } from "./origin.ts";

const SELF = "https://www.keylearn.com";

test("our own pages connect", () => {
  isTrue(allowWebSocketOrigin(SELF, SELF));
  isTrue(allowWebSocketOrigin("HTTPS://WWW.KEYLEARN.COM", SELF), "case");
});

test("another site cannot open a socket from a visitor's browser", () => {
  // A browser always sends Origin on a WebSocket handshake and script cannot
  // override it, so this is the check that makes cross-site connections
  // refusable at all.
  isFalse(allowWebSocketOrigin("https://evil.example", SELF));
  isFalse(allowWebSocketOrigin("http://www.keylearn.com", SELF), "scheme");
  isFalse(allowWebSocketOrigin("https://keylearn.com", SELF), "host");
  isFalse(allowWebSocketOrigin("https://www.keylearn.com.evil.test", SELF));
});

test("a prefix of our origin is not our origin", () => {
  // The sneaky ones: a header carrying a path or a trailing slash would pass
  // a startsWith check.
  isFalse(allowWebSocketOrigin("https://www.keylearn.com.evil.test", SELF));
  isFalse(allowWebSocketOrigin(`${SELF}.evil.test`, SELF));
  isFalse(allowWebSocketOrigin(`${SELF}/`, SELF), "trailing slash");
  isFalse(allowWebSocketOrigin(`${SELF}@evil.test`, SELF), "userinfo trick");
});

test("a sandboxed or file:// page is refused", () => {
  // "null" is an opaque origin, never ours, and exactly the caller worth
  // turning away.
  isFalse(allowWebSocketOrigin("null", SELF));
});

test("a client that sends no origin at all is allowed", () => {
  // Health checks, test harnesses and native clients send none, and a
  // handshake with no origin is not the cross-site case this guards.
  isTrue(allowWebSocketOrigin(null, SELF));
  isTrue(allowWebSocketOrigin("", SELF));
});
