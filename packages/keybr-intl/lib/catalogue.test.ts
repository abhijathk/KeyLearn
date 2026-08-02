import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { equal } from "rich-assert";

/**
 * The catalogue has to know every message the code asks for.
 *
 * When it does not, nothing warns: `compile-messages.mjs` only emits ids it
 * finds in `translations/en.json`, so a missing one leaves react-intl with no
 * message at all and it renders the hashed id — eight random-looking
 * characters where a sentence should be. It is invisible until somebody
 * happens to look at that exact screen, and it has slipped through more than
 * once.
 *
 * Both id shapes count: the dotted ones and the `t_Something` shorthand. An
 * earlier version of this check only looked at dotted ids, and `t_Space` went
 * out rendering as `TqbSBcKK`.
 *
 * A stale entry is worse. If the catalogue still asks for a placeholder the
 * component has stopped passing, formatting throws and the same hash appears —
 * so the second test compares the placeholders rather than the wording, which
 * is the part that has to agree.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));

const catalogue: Record<string, string> = JSON.parse(
  readFileSync(`${root}/packages/keybr-intl/translations/en.json`, "utf8"),
);

/** Every `id` paired with its `defaultMessage`, as written in the source. */
function declared(): Map<string, string> {
  const found = new Map<string, string>();
  const files = globSync("packages/*/lib/**/*.{ts,tsx}", { cwd: root });
  const pattern =
    /id[:=]\s*[{"']([\w]+(?:\.[\w]+)+)["'}][\s,]*\n?\s*defaultMessage[:=]\s*\{?\s*((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(?:\s*\+\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))*)/g;
  for (const file of files) {
    if (file.includes("/messages/") || file.includes("/.types/")) {
      continue;
    }
    const text = readFileSync(`${root}/${file}`, "utf8");
    for (const match of text.matchAll(pattern)) {
      if (!found.has(match[1])) {
        const parts = match[2].matchAll(
          /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g,
        );
        found.set(match[1], [...parts].map((p) => p[1] ?? p[2]).join(""));
      }
    }
  }
  return found;
}

/** The `{names}` an ICU message requires of whoever formats it. */
function placeholders(message: string): ReadonlySet<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)) {
    names.add(match[1]);
  }
  return names;
}

const source = declared();

test("every message the code asks for is in the catalogue", () => {
  const missing = [...source.keys()].filter((id) => !(id in catalogue)).sort();
  equal(
    missing.join(", "),
    "",
    "these ids render as their hash — add them to packages/keybr-intl/translations/en.json",
  );
});

test("the catalogue asks for no value the code does not pass", () => {
  const wrong: string[] = [];
  for (const [id, message] of source) {
    const stored = catalogue[id];
    if (stored == null) {
      continue;
    }
    // A value the code passes and the message ignores is harmless. A value the
    // message needs and the code never passes makes formatting throw, which
    // surfaces as the hashed id.
    for (const name of placeholders(stored)) {
      if (!placeholders(message).has(name)) {
        wrong.push(`${id} needs {${name}}`);
      }
    }
  }
  equal(
    wrong.join(", "),
    "",
    "the catalogue is out of step with the source; resync these messages",
  );
});
