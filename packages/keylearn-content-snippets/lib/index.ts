import { type Snippet, type SnippetSet } from "./types.ts";

export * from "./highlight.ts";
export * from "./themes.ts";
export * from "./types.ts";

/** Set when the learner has asked not to be given the comments. */
export const HIDE_COMMENTS = "hideComments";

/**
 * Every topic id across every corpus, plus the comment switch.
 *
 * The setting that stores these validates against a fixed list and silently
 * drops anything it does not recognise — so a topic missing from here would
 * work until the page was reloaded and then quietly turn itself back on.
 *
 * Written out rather than derived from the corpora, because the settings need
 * it when the page starts and the corpora are only fetched when a code lesson
 * opens. `snippets.test.ts` fails if it ever drifts from the sets.
 */
export const SNIPPET_FLAGS: readonly string[] = [
  "basics",
  "ownership",
  "types",
  "collections",
  "templates",
  "errors",
  "structure",
  "c",
  "nullability",
  "patterns",
  "linq",
  "async",
  "testing",
  "layout",
  "selectors",
  "typography",
  "motion",
  "accessibility",
  "locators",
  "actions",
  "assertions",
  "network",
  "api",
  "ui",
  "interfaces",
  "concurrency",
  "stdlib",
  "forms",
  "media",
  "interactive",
  "streams",
  "generics",
  "functions",
  "arrays",
  "objects",
  "modules",
  "dom",
  "syntax",
  "tooling",
  "schema",
  "null",
  "control",
  "idiom",
  "coroutines",
  "database",
  "locator",
  "action",
  "assertion",
  "config",
  "select",
  "transform",
  "aggregate",
  "join",
  "reshape",
  "quality",
  "timeseries",
  "stats",
  "viz",
  "performance",
  "component",
  "jsx",
  "hooks",
  "state",
  "effect",
  "groups",
  "lookaround",
  "flags",
  "using",
  "matching",
  "traits",
  "iterators",
  "waits",
  "browser",
  "conditionals",
  "loops",
  "safety",
  "ddl",
  "index",
  "dml",
  "transaction",
  "subquery",
  "window",
  "cte",
  "analytics",
  "optionals",
  "protocols",
  "swiftui",
  "narrowing",
  "utility",
  "advanced",
  "classes",
  "ci",
  "docker",
  "kubernetes",
  HIDE_COMMENTS,
];

let loaded: readonly SnippetSet[] | null = null;
let loading: Promise<readonly SnippetSet[]> | null = null;

/**
 * Every corpus, fetched on first use as its own chunk rather than inside the
 * bundle every page loads. The lesson loader awaits this before it builds a
 * code lesson, so the synchronous lookups below always have it by then.
 */
export function loadSnippetSets(): Promise<readonly SnippetSet[]> {
  loading ??= import(/* webpackChunkName: "code-snippets" */ "./sets.ts").then(
    (module) => (loaded = module.SNIPPET_SETS),
    (err: unknown) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

function snippetSets(): readonly SnippetSet[] {
  if (loaded == null) {
    throw new Error(
      "Code snippets are not loaded yet: await loadSnippetSets()",
    );
  }
  return loaded;
}

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
  for (const set of snippetSets()) {
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
  return snippetSets().find((set) => set.syntax === syntax) ?? null;
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
