import { json, yaml } from "./snippets/config-ts.ts";
import { cpp } from "./snippets/cpp-set.ts";
import { cypress } from "./snippets/cypress-ts.ts";
import { go } from "./snippets/go-set.ts";
import { java } from "./snippets/java-set.ts";
import { kotlin, swift } from "./snippets/mobile-ts.ts";
import { php } from "./snippets/php-set.ts";
import { playwrightJs, playwrightTs } from "./snippets/playwright-ts.ts";
import { python } from "./snippets/python-ts.ts";
import { react } from "./snippets/react-ts.ts";
import { regex } from "./snippets/regex-set.ts";
import { rust } from "./snippets/rust-set.ts";
import { seleniumJv, seleniumPy } from "./snippets/selenium-ts.ts";
import { sqlPostgres, sqlServer } from "./snippets/sql-ts.ts";
import { csharp, shell } from "./snippets/systems-ts.ts";
import { typescript } from "./snippets/typescript-set.ts";
import { css, html, javascript } from "./snippets/web-ts.ts";
import { type Snippet, type SnippetSet } from "./types.ts";

export * from "./highlight.ts";
export * from "./themes.ts";
export * from "./types.ts";

/**
 * Every corpus we have, keyed by the `Syntax` id the practice settings use.
 *
 * A language appears here once its snippets are written and its formatter gate
 * passes; there is deliberately no placeholder for the ones that are not
 * written yet, so an empty menu entry can never appear.
 */
export const SNIPPET_SETS: readonly SnippetSet[] = [
  cpp,
  csharp,
  css,
  cypress,
  go,
  html,
  java,
  javascript,
  json,
  kotlin,
  php,
  playwrightTs,
  playwrightJs,
  python,
  react,
  regex,
  rust,
  seleniumPy,
  seleniumJv,
  shell,
  sqlPostgres,
  sqlServer,
  swift,
  typescript,
  yaml,
];

/** Set when the learner has asked not to be given the comments. */
export const HIDE_COMMENTS = "hideComments";

/**
 * Every topic id across every corpus, plus the comment switch.
 *
 * The setting that stores these validates against a fixed list and silently
 * drops anything it does not recognise — so a topic missing from here would
 * work until the page was reloaded and then quietly turn itself back on.
 */
export const SNIPPET_FLAGS: readonly string[] = [
  ...new Set(SNIPPET_SETS.flatMap((set) => set.topics.map(({ id }) => id))),
  HIDE_COMMENTS,
];

/**
 * The same code with its comments taken out.
 *
 * Whole-line comments only. A comment sitting at the end of a line of code
 * cannot be removed by looking at the text alone — the same characters appear
 * inside string literals and regular expressions — and a snippet that has been
 * mangled teaches the wrong thing more convincingly than one that is merely
 * long.
 */
export function withoutComments(
  code: string,
  prefixes: readonly string[] = ["//"],
  block: readonly [open: string, close: string] | null = ["/*", "*/"],
): string {
  const kept: string[] = [];
  let inBlock = false;
  for (const line of code.split("\n")) {
    const text = line.trim();
    if (block != null) {
      const [open, close] = block;
      if (inBlock) {
        inBlock = !text.endsWith(close);
        continue;
      }
      if (text.startsWith(open)) {
        inBlock = !text.endsWith(close);
        continue;
      }
    }
    if (prefixes.some((prefix) => text.startsWith(prefix))) {
      continue;
    }
    kept.push(line);
  }
  const stripped = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // A snippet that was nothing but a comment would otherwise vanish, leaving
  // the learner an empty lesson and no way to tell why.
  return stripped.length > 0 ? stripped : code;
}

/** The frameworks that have a corpus, each with the languages it is written in. */
export function frameworks(): readonly {
  name: string;
  sets: readonly SnippetSet[];
}[] {
  const byName = new Map<string, SnippetSet[]>();
  for (const set of SNIPPET_SETS) {
    const sets = byName.get(set.framework) ?? [];
    sets.push(set);
    byName.set(set.framework, sets);
  }
  return [...byName].map(([name, sets]) => ({ name, sets }));
}

export function frameworkOf(syntax: string): {
  name: string;
  sets: readonly SnippetSet[];
} | null {
  return (
    frameworks().find((f) => f.sets.some((s) => s.syntax === syntax)) ?? null
  );
}

export function snippetSetFor(syntax: string): SnippetSet | null {
  return SNIPPET_SETS.find((set) => set.syntax === syntax) ?? null;
}

/**
 * The snippets for a syntax, hardest last.
 *
 * Sorted rather than shuffled: the corpus is meant to be worked through. The
 * caller decides how far down the list a learner has reached — a shuffle would
 * put a worker fixture in front of someone who has not yet typed a locator.
 */
export function snippetsFor(
  syntax: string,
  topics: readonly string[] = [],
): readonly Snippet[] {
  const set = snippetSetFor(syntax);
  if (set == null) {
    return [];
  }
  // No topic chosen means the whole corpus. Switching every one of them off
  // would otherwise leave nothing to type, which reads as the app being
  // broken rather than as a setting having been taken to its limit.
  const wanted = topics.filter((t) => set.topics.some(({ id }) => id === t));
  const chosen =
    wanted.length === 0
      ? set.snippets
      : set.snippets.filter((s) => s.tags.some((t) => wanted.includes(t)));
  const usable = chosen.length > 0 ? chosen : set.snippets;
  return [...usable].sort((a, b) => a.level - b.level);
}
