import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { deepEqual, isTrue } from "rich-assert";

/**
 * A guard against the one way a learner's settings stop following them.
 *
 * The mirror in `local-sync.ts` carries `localStorage` itself, so anything
 * written there is portable by default and a new setting is portable because
 * it is a setting. That design has exactly one blind spot, and it is the one
 * that actually bit: state written somewhere ELSE. The theme — day or night,
 * the font, the text size — lived in a cookie for exactly that reason, and
 * so it was the one preference that never travelled, while the accent
 * sitting beside it in the same settings panel did.
 *
 * A grep is a crude test and the right one here. The failure it catches is
 * not a broken function, it is a decision: somebody reaching for a cookie or
 * a database in the browser because it was the closest tool, without knowing
 * that it takes the setting off the account. Every such site has to be on
 * the list below with a reason, so the decision is made deliberately or not
 * at all.
 */

const CLIENT_PACKAGES = [
  "keylearn-pages-browser",
  "keylearn-pages-shared",
  "keylearn-settings",
  "keylearn-themes",
  "page-account",
  "page-practice",
  "page-kids",
  "page-braille",
  "page-typing-test",
];

/**
 * Places a learner's state is deliberately NOT in browser storage, and why.
 *
 * A cookie is per browser, so anything here is per browser. That is right
 * for a thing about the device and wrong for a thing about the learner.
 */
const ALLOWED_OUTSIDE_STORAGE: Readonly<Record<string, string>> = {
  "keylearn-pages-browser/lib/themes/ThemeProvider.tsx":
    "The theme cookie is this device's cache of the choice, so the SERVER can " +
    "paint the first frame in the right colours. The choice itself is written " +
    "to browser storage beside it and travels with the account.",
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".types" || entry === "dist") {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) {
      out.push(path);
    }
  }
  return out;
}

const root = new URL("../../../../../", import.meta.url).pathname;

test("no learner state is written outside browser storage without a reason", () => {
  const offenders: string[] = [];
  for (const pkg of CLIENT_PACKAGES) {
    for (const file of walk(join(root, "packages", pkg))) {
      const source = readFileSync(file, "utf8");
      // A write, not a read: `document.cookie` on its own is how anything
      // reads one, and reading a cookie takes nothing off the account.
      if (!/document\.cookie\s*=/.test(source)) {
        continue;
      }
      const rel = relative(join(root, "packages"), file).replace(/\\/g, "/");
      const key = rel.replace(/^/, "");
      if (ALLOWED_OUTSIDE_STORAGE[key] == null) {
        offenders.push(rel);
      }
    }
  }
  deepEqual(
    [...offenders].sort(),
    [],
    "a learner setting was written to a cookie, which does not follow them to " +
      "another device. Put it in localStorage — the mirror carries that — or " +
      "add it to ALLOWED_OUTSIDE_STORAGE with the reason it is per-device.",
  );
});

test("every allowance names a file that still exists and still writes a cookie", () => {
  const stale: string[] = [];
  for (const rel of Object.keys(ALLOWED_OUTSIDE_STORAGE)) {
    let source = "";
    try {
      source = readFileSync(join(root, "packages", rel), "utf8");
    } catch {
      stale.push(`${rel} (missing)`);
      continue;
    }
    if (!/document\.cookie\s*=/.test(source)) {
      stale.push(`${rel} (no longer writes a cookie)`);
    }
  }
  deepEqual(
    [...stale],
    [],
    "an allowance outlived what it was allowing; remove it",
  );
});

test("the theme is written to browser storage, so the mirror carries it", () => {
  const source = readFileSync(
    join(root, "packages/keylearn-pages-browser/lib/themes/ThemeProvider.tsx"),
    "utf8",
  );
  isTrue(
    /localStorage\.setItem\(\s*themeStorageKey\(\)/.test(source),
    "the theme is no longer stored where the mirror can see it",
  );
  isTrue(
    /localStorage\.getItem\(themeStorageKey\(\)\)/.test(source),
    "the theme is no longer read back from storage, so a synced one is ignored",
  );
  isTrue(
    /profileStorageKeyFor\(activeProfileId\(\)/.test(source),
    "the theme is not keyed per learner, so one profile's colours would " +
      "become the whole household's",
  );
});

test("the mirror still refuses to carry the things that have their own route", () => {
  const source = readFileSync(
    join(root, "packages/keylearn-pages-shared/lib/local-sync.ts"),
    "utf8",
  );
  // Each of these syncs by a mechanism that does more than copy bytes, and
  // letting the mirror also carry one would put two syncs in a race.
  for (const key of [
    "settings",
    "keylearn.a11y",
    "keylearn.braille.",
    "keylearn.support.outbox",
    "keylearn.ngrams",
  ]) {
    isTrue(
      source.includes(`"${key}"`),
      `${key} left the mirror's exclusion list without a replacement`,
    );
  }
});
