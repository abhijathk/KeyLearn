import { test } from "node:test";
import { ApplicationError } from "@fastr/errors";
import { equal, isTrue } from "rich-assert";
import { checkStatus } from "./middleware.ts";

/**
 * The layer that decides whether a response is a failure.
 *
 * Every API call in the app goes through this, and it had no tests. What it
 * does is small enough to read in a minute and subtle enough that I got it
 * wrong myself this week: trying to simulate a 428 for the grown-up PIN
 * prompt, I served the error body as `application/json` and nothing threw, so
 * the prompt never appeared and I spent a while looking for the fault in the
 * prompt. The content type is the whole switch.
 *
 * The consequence of it breaking is not an error message — it is failures
 * arriving as successes. A 428 that does not throw is a page that carries on
 * as though the write happened.
 */

/** A response shaped the way the adapter hands one over. */
function response(
  status: number,
  contentType: string | null,
  body: unknown,
): any {
  const headers = new Headers();
  if (contentType != null) {
    headers.set("content-type", contentType);
  }
  return {
    status,
    headers,
    async json() {
      return body;
    },
  };
}

const run = async (res: any) =>
  await checkStatus()({} as any, (async () => res) as any);

test("an error response becomes a thrown error, with its status", async () => {
  const res = response(428, ApplicationError.MIME_TYPE, {
    error: { message: "Grown-up PIN required", parentPin: true },
  });
  try {
    await run(res);
    isTrue(false, "it should have thrown");
  } catch (err: any) {
    isTrue(err instanceof ApplicationError, `threw ${err?.constructor?.name}`);
    equal(err.status, 428);
    equal(err.message, "Grown-up PIN required");
  }
});

test("the fields a caller keys on survive onto the error", async () => {
  // `parentPin` is what tells the page to raise the PIN prompt rather than
  // show a bare failure. If the body were flattened to a message, the caller
  // could not tell "prove who you are" from "that went wrong", and a parent
  // would get an error where they should get a keypad.
  const res = response(428, ApplicationError.MIME_TYPE, {
    error: { message: "Grown-up PIN required", parentPin: true },
  });
  try {
    await run(res);
    isTrue(false, "it should have thrown");
  } catch (err: any) {
    equal(err.body?.error?.parentPin, true);
  }
});

test("plain JSON is NOT treated as an error, whatever the status", async () => {
  // The switch is the content type, not the status code — which is exactly
  // what caught me. A route answering `application/json` is answering
  // normally, and this must hand it back rather than invent a failure.
  const res = response(428, "application/json", {
    error: { message: "looks like an error, is not one" },
  });
  const out = await run(res);
  equal(out, res);
});

test("a success passes through untouched", async () => {
  const res = response(200, "application/json", { profiles: [] });
  equal(await run(res), res);
});

test("an error response with an unreadable body still fails", async () => {
  // The dangerous direction is a failure that arrives as a success. If the
  // body cannot be parsed into an error, this must still throw — falling back
  // to a vague error is right, and returning the response would let a caller
  // treat a rejected write as a completed one.
  const res = response(500, ApplicationError.MIME_TYPE, { nonsense: true });
  try {
    await run(res);
    isTrue(false, "it should have thrown");
  } catch (err: any) {
    isTrue(err instanceof ApplicationError, `threw ${err?.constructor?.name}`);
    equal(err.status, 500);
  }
});

test("a response with no content type is passed through, not guessed at", async () => {
  // Guessing would mean deciding a body is an error because it happens to
  // have an `error` key, and plenty of successful payloads do.
  const res = response(204, null, {});
  equal(await run(res), res);
});
