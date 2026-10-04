import { test } from "node:test";
import { isFalse, isTrue } from "rich-assert";
import { isParentPinRequired, isReauthRequired } from "./service.ts";

const err = (status: number, error: object) => ({
  status,
  body: { error: { message: "x", ...error } },
});

test("a 428 is a PIN request only with the parentPin marker", () => {
  isTrue(isParentPinRequired(err(428, { parentPin: true })));
  // The Turnstile challenge is also a 428 — it is not a PIN request.
  isFalse(isParentPinRequired(err(428, { captcha: true })));
  isFalse(isParentPinRequired(err(403, { parentPin: true })));
  isFalse(isParentPinRequired(null));
});

test("a 403 asks for re-authentication only with the reauth marker", () => {
  isTrue(isReauthRequired(err(403, { reauth: true })));
  isFalse(isReauthRequired(err(403, {})));
  isFalse(isReauthRequired(err(428, { reauth: true })));
  isFalse(isReauthRequired(undefined));
});
