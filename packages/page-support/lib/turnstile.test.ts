import { test } from "node:test";
import { isFalse, isTrue } from "rich-assert";
import { isCaptchaRequired } from "./turnstile.tsx";

const err = (status: number, error: object) => ({
  status,
  body: { error: { message: "x", ...error } },
});

test("the human check is asked for by its marker or a bare 428", () => {
  isTrue(isCaptchaRequired(err(428, { captcha: true })));
  isTrue(isCaptchaRequired(err(428, {})));
});

test("the grown-up PIN gate's 428 is not a captcha request", () => {
  isFalse(isCaptchaRequired(err(428, { parentPin: true })));
  isFalse(
    isCaptchaRequired(
      err(428, { parentPin: true, parentPinSetupRequired: true }),
    ),
  );
});

test("an unreachable check (503) is not something to solve", () => {
  isFalse(isCaptchaRequired(err(503, { captcha: false })));
  isFalse(isCaptchaRequired(err(429, {})));
});
