import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { deepEqual } from "rich-assert";

/**
 * No thrown HttpError may carry a non-ASCII character in its message.
 *
 * The framework writes that message into the HTTP status line, and Node
 * refuses to send a response whose status line holds a byte above 127.
 * The result is not a wrong message or an ugly one — the response is
 * never written at all, so the request hangs until something times out.
 *
 * It is a uniquely nasty failure to find by hand, because the code reads
 * correctly, the error is the right error, and the only symptom is a page
 * that never finishes. It was found here by a test that happened to sit
 * on a message with an em dash in it; this makes that luck repeatable.
 *
 * Only the FIRST argument is checked. `description` and every other field
 * are written into the response body, where typographic punctuation is
 * correct and wanted.
 */

const HTTP_ERRORS = [
  "BadRequest",
  "Unauthorized",
  "PaymentRequired",
  "Forbidden",
  "NotFound",
  "MethodNotAllowed",
  "NotAcceptable",
  "RequestTimeout",
  "LengthRequired",
  "PayloadTooLarge",
  "UnsupportedMediaType",
  "UpgradeRequired",
  "InternalServer",
  "NotImplemented",
  "BadGateway",
  "ServiceUnavailable",
];

const pattern = new RegExp(
  String.raw`\b(?:new\s+)?(${HTTP_ERRORS.join("|")})Error\s*\(`,
  "g",
);

/** The argument list, read to the balancing parenthesis. */
function argumentsOf(source: string, from: number): string {
  let depth = 1;
  let at = from;
  while (at < source.length && depth > 0) {
    if (source[at] === "(") {
      depth++;
    } else if (source[at] === ")") {
      depth--;
    }
    at++;
  }
  return source.slice(from, at - 1);
}

test("no thrown error message can break the HTTP status line", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const listed = execFileSync("git", ["ls-files", "lib/**/*.ts"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => file !== "" && !file.endsWith(".test.ts"));

  const offenders: string[] = [];
  for (const file of listed) {
    const source = readFileSync(join(root, file), "utf8");
    for (const found of source.matchAll(pattern)) {
      const args = argumentsOf(source, found.index + found[0].length);
      // Splitting on the first top-level comma is enough: a message is a
      // string literal or a concatenation of them, never an object.
      const message = args.split(/,(?![^{]*})/)[0] ?? "";
      for (const literal of message.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
        const outside = [...literal[1]!].filter((c) => c.codePointAt(0)! > 127);
        if (outside.length > 0) {
          const line = source.slice(0, found.index).split("\n").length;
          offenders.push(
            `${file}:${line} ${found[1]!}Error contains ${JSON.stringify(
              outside.join(""),
            )} — use plain ASCII in the message, or move the text to \`description\``,
          );
        }
      }
    }
  }

  deepEqual(offenders, []);
});
