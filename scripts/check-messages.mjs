// Every message id used in the source must exist in the English catalogue.
//
// A missing id does not fail loudly. react-intl falls back, and what the user
// sees is the *hashed* id rendered as visible text — "RRlKX9d4 XhgSaevJ" where
// "Certificate earned. Open and download" should be. It looks like corruption
// rather than like a missing translation, and it reaches production happily,
// because nothing in the build has any reason to object.
//
// Run: node scripts/check-messages.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJsonSync } from "./lib/fs-json.js";
import { translationsPath } from "./lib/intl-io.js";
import { defaultLocale } from "./locale.js";

const ROOT = join(import.meta.dirname, "..", "packages");
const SKIP = new Set(["node_modules", ".types", "lib/messages"]);

/**
 * `id` and `defaultMessage` as a pair, in either the JSX or the object form.
 *
 * Deliberately narrow: `defineMessage({...})` and `<FormattedMessage .../>`
 * both require a literal id here, which is what makes matching them with a
 * regex sound rather than a guess.
 */
const PAIR =
  /\bid[=:]\s*\{?["']([^"']+)["']\}?[,\s]*\n?\s*defaultMessage[=:]\s*\{?((?:["'](?:[^"'\\]|\\.)*["']\s*\+?\s*)+)/g;

/**
 * The message text from one or more adjacent string literals.
 *
 * A long default message is often written as `"first half " + "second
 * half"`, which the real extractor joins before it ever reaches the
 * catalogue. Reading only the first literal made two identical messages
 * look like a conflict — and since this check gates CI, that is a build
 * failed over nothing. Joined here the same way.
 */
function literalText(raw) {
  let out = "";
  for (const [, piece] of raw.matchAll(/["']((?:[^"'\\]|\\.)*)["']/g)) {
    out += piece;
  }
  return out;
}

function* sources(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* sources(path);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield path;
    }
  }
}

const catalogue = readJsonSync(translationsPath(defaultLocale));
const missing = new Map();
/** id -> Map(defaultMessage -> Set(file)). */
const uses = new Map();

for (const file of sources(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const [, id, raw] of text.matchAll(PAIR)) {
    const message = literalText(raw);
    if (!(id in catalogue)) {
      missing.set(id, file.slice(ROOT.length + 1));
    }
    if (!uses.has(id)) {
      uses.set(id, new Map());
    }
    const seen = uses.get(id);
    if (!seen.has(message)) {
      seen.set(message, new Set());
    }
    seen.get(message).add(file.slice(ROOT.length + 1));
  }
}

// Two places using one id for different things is not a translation problem —
// it is one screen silently renaming another. The User Guide's menu entry
// became "About the assessment" this way, because a new dialog reused
// `guide.title`. Reported rather than fatal: a handful of long-standing ones
// differ only in wording ("Close" / "Dismiss") and are harmless.
const clashes = [...uses].filter(([, seen]) => seen.size > 1);
if (clashes.length > 0) {
  console.warn(`${clashes.length} id(s) are used with conflicting text:`);
  for (const [id, seen] of clashes.sort()) {
    console.warn(`  ${id}`);
    for (const [message, files] of seen) {
      console.warn(`    "${message.slice(0, 60)}"  —  ${[...files].join(", ")}`);
    }
  }
  console.warn("");
}

if (missing.size > 0) {
  console.error(
    `${missing.size} message id(s) are used but absent from ` +
      `translations/${defaultLocale}.json — each would render as a hash:`,
  );
  for (const [id, file] of [...missing].sort()) {
    console.error(`  ${id}  (${file})`);
  }
  console.error(
    "\nAdd them to the catalogue and run: node scripts/compile-messages.mjs",
  );
  process.exit(1);
}

console.log(`all message ids are in translations/${defaultLocale}.json`);
