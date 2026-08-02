import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { available, formatAll } from "./format.ts";
import {
  highlight,
  SNIPPET_SETS,
  TYPESCRIPT,
  withoutComments,
} from "./index.ts";

/**
 * An id names one piece of code, wherever it appears.
 *
 * Two corpora may share a snippet — nearly every Playwright example is valid
 * in both TypeScript and JavaScript, and copying it into each would double the
 * corpus to teach nothing and drift the first time one copy was corrected. So
 * the rule is not that ids are globally unique but that they are honest: the
 * same id twice must be the same text, and it must appear once within a set.
 */
test("an id always names the same code", () => {
  const seen = new Map<string, string>();
  for (const set of SNIPPET_SETS) {
    const here = new Set<string>();
    for (const { id, code } of set.snippets) {
      isTrue(!here.has(id), `${set.syntax} lists ${id} twice`);
      here.add(id);
      const first = seen.get(id);
      if (first == null) {
        seen.set(id, code);
      } else {
        equal(code, first, `${id} means different code in ${set.syntax}`);
      }
    }
  }
});

test("snippets are trimmed and non-empty", () => {
  for (const set of SNIPPET_SETS) {
    for (const { id, code, title } of set.snippets) {
      isTrue(code.length > 0, `${id} is empty`);
      equal(code, code.trim(), `${id} has leading or trailing whitespace`);
      isTrue(title.length > 0, `${id} has no title`);
      // A tab renders at whatever width the container says, so it is only
      // allowed where the language's own formatter insists on it — which is
      // Go and nowhere else.
      isTrue(
        set.indentsWithTabs === true || !code.includes("\t"),
        `${id} contains a tab`,
      );
      isTrue(!/[ ]+$/m.test(code), `${id} has trailing spaces on a line`);
    }
  }
});

test("snippets are levelled and tagged", () => {
  for (const set of SNIPPET_SETS) {
    for (const { id, level, tags } of set.snippets) {
      isTrue(level >= 1 && level <= 5, `${id} has level ${level}`);
      isTrue(tags.length > 0, `${id} has no tags`);
    }
  }
});

/**
 * The claim these snippets make is that typing them teaches a real coding
 * standard. That is only true if they are formatted exactly the way the real
 * tool would format them — a near-miss drilled into muscle memory is worse
 * than teaching nothing — so the real tool decides, not us.
 *
 * Skipped with a warning when the formatter is not installed, because a
 * contributor without Prettier on their PATH should still be able to run the
 * suite. CI has it, and that is where this has to pass.
 */
for (const set of SNIPPET_SETS) {
  test(`${set.syntax} snippets match ${set.standard}`, async (t) => {
    if (!available(set.formatter)) {
      t.skip(`${set.formatter.command} is not installed`);
      return;
    }
    const wrong: string[] = [];
    const unparseable: string[] = [];
    const results = await formatAll(set);
    for (const snippet of set.snippets) {
      const result = results.get(snippet.id)!;
      if (!result.ok) {
        unparseable.push(`${snippet.id} (${result.reason})`);
      } else if (result.code !== snippet.code) {
        wrong.push(snippet.id);
      }
    }
    // Reported rather than failed. A snippet the formatter cannot read is
    // ungated, which is worth knowing about — but the cause is as often a gap
    // in the formatter's dialect as a fault in the snippet, and failing the
    // build over the tool's limitations would teach the suite to be ignored.
    if (unparseable.length > 0) {
      t.diagnostic(`ungated, ${set.formatter.command} could not parse:`);
      for (const line of unparseable) {
        t.diagnostic(`  ${line}`);
      }
    }
    equal(
      wrong.join(", "),
      "",
      `these snippets are not formatted as ${set.standard} would leave them`,
    );
  });
}

test("comments can be taken out without breaking the code", () => {
  equal(withoutComments(["// why", "const a = 1;"].join("\n")), "const a = 1;");
  equal(
    withoutComments(["/* one", " * two */", "const a = 1;"].join("\n")),
    "const a = 1;",
  );
  // A trailing comment is left alone: the same characters appear inside string
  // literals, and a mangled snippet teaches the wrong thing convincingly.
  equal(
    withoutComments("const url = 'https://example.com'; // keep"),
    "const url = 'https://example.com'; // keep",
  );
  // A snippet that is nothing but a comment would otherwise become an empty
  // lesson with no explanation.
  equal(withoutComments("// all of it"), "// all of it");
});

test("every corpus can have its comments taken out", () => {
  for (const set of SNIPPET_SETS) {
    for (const { id, code } of set.snippets) {
      const stripped = withoutComments(
        code,
        set.lineComment,
        set.lexicon.blockComment,
      );
      isTrue(stripped.trim().length > 0, `${id} became empty`);
    }
  }
});

test("highlighting covers the whole text and nothing more", () => {
  for (const set of SNIPPET_SETS) {
    for (const { id, code } of set.snippets) {
      const tokens = highlight(code, set.lexicon);
      const rebuilt = tokens
        .map((t) => (typeof t === "string" ? t : t.text))
        .join("");
      // Losing or duplicating a character would change what the learner has
      // to type, which is far worse than colouring something wrongly.
      equal(rebuilt, code, `${id} was altered by highlighting`);
    }
  }
});

test("highlighting recognises the four classes", () => {
  const of = (code: string) =>
    highlight(code, TYPESCRIPT)
      .filter((t) => typeof t !== "string")
      .map((t) => t.cls);
  deepEqual(of("// note"), ["comment"]);
  deepEqual(of("const x = 1;"), ["keyword", "number"]);
  deepEqual(of("fill('ada')"), ["string"]);
  // A keyword inside a string is part of the string, not a keyword.
  deepEqual(of("'const'"), ["string"]);
  // A comment marker inside a string likewise.
  deepEqual(of("'http://x'"), ["string"]);
});
