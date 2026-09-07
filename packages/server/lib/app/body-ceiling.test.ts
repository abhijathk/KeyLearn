import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { bodyCeiling, MAX_REQUEST_BODY } from "./body-ceiling.ts";

/**
 * No request may be unbounded.
 *
 * @fastr reads a body with no limit unless the route asks for one, and
 * most routes here do not. Without a ceiling, refusing an oversized
 * upload costs the memory to hold it first — the attachment route's own
 * size check runs after the body is buffered, JSON-parsed AND
 * base64-decoded.
 *
 * Exercised directly rather than over HTTP because the test client sets
 * `content-length` from the body it actually sends, so a claimed length
 * cannot be posted through it — and the claim is the whole input here.
 */

/** The two things the middleware reads, and nothing else. */
const call = async (contentLength: string | null) => {
  let reached = false;
  const ctx = {
    request: {
      headers: {
        get: (name: string) =>
          name === "content-length" ? contentLength : null,
      },
    },
  } as never;
  try {
    await bodyCeiling()(ctx, async () => {
      reached = true;
    });
    return { status: 200, reached };
  } catch (err) {
    return { status: (err as { status?: number }).status ?? 500, reached };
  }
};

test("a body claiming more than the ceiling is refused", async () => {
  const { status, reached } = await call(String(MAX_REQUEST_BODY + 1));
  equal(status, 413);
  isTrue(!reached, "and the route never runs, so nothing reads the body");
});

test("a body at the ceiling is allowed", async () => {
  const { status, reached } = await call(String(MAX_REQUEST_BODY));
  equal(status, 200);
  isTrue(reached);
});

test("an ordinary request passes", async () => {
  const { status, reached } = await call("2048");
  equal(status, 200);
  isTrue(reached);
});

test("no content-length is passed on, not refused", async () => {
  // A chunked request has no claim to check. It reaches the route, whose
  // own maxLength is what bounds it — this ceiling is the floor under
  // that, never the only thing holding.
  const { status, reached } = await call(null);
  equal(status, 200);
  isTrue(reached);
});

test("a nonsense content-length is not treated as enormous", async () => {
  for (const claim of ["abc", "", "-1"]) {
    const { status } = await call(claim);
    equal(status, 200, `content-length: ${JSON.stringify(claim)}`);
  }
});

test("the ceiling clears the largest legitimate upload", async () => {
  // 10 MB of file is ~13.98 MB of base64. If the ceiling ever drops
  // below that, attachments break and this says so before a customer
  // finds out.
  const base64OfMaxFile = Math.ceil((10 * 1024 * 1024) / 3) * 4;
  isTrue(
    MAX_REQUEST_BODY > base64OfMaxFile,
    `ceiling ${MAX_REQUEST_BODY} must exceed ${base64OfMaxFile}`,
  );
});
