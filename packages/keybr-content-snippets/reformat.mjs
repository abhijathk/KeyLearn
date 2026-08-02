#!/usr/bin/env node
/**
 * Run every corpus through its own formatter and write the result back.
 *
 * The companion to the gate in `lib/snippets.test.ts`. The test says which
 * snippets do not match their standard; this fixes them, so nobody has to
 * hand-reproduce a formatter's line-wrapping decisions.
 *
 * Snippets live inside TypeScript template literals, so the edit is textual:
 * the escaped form of the old code is found in the source and swapped for the
 * escaped form of the new. Escaping is the inverse of what the parser did, and
 * anything that cannot be matched exactly is reported rather than guessed at.
 *
 * Usage:
 *   node reformat.mjs            # every corpus
 *   node reformat.mjs sql_tsql   # one, by syntax id
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { available, formatAll } from "./lib/format.ts";
import { SNIPPET_SETS } from "./lib/index.ts";

const SNIPPET_DIR = fileURLToPath(new URL("./lib/snippets/", import.meta.url));

/** The inverse of what the TypeScript parser did to produce `code`. */
function escapeTemplate(text) {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("${", "\\${");
}

const only = process.argv[2];
const sources = readdirSync(SNIPPET_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, path: SNIPPET_DIR + name }));
const contents = new Map(
  sources.map(({ name, path }) => [name, readFileSync(path, "utf8")]),
);

let changed = 0;
let failed = 0;

for (const set of SNIPPET_SETS) {
  if (only != null && set.syntax !== only) {
    continue;
  }
  if (!available(set.formatter)) {
    console.log(`${set.syntax}: ${set.formatter.command} not found, skipped`);
    continue;
  }
  let fixed = 0;
  let unparseable = 0;
  const results = await formatAll(set);
  for (const snippet of set.snippets) {
    const result = results.get(snippet.id);
    // A snippet the formatter cannot read is a real problem, but not one this
    // script can fix, so it is reported and left alone.
    if (!result.ok) {
      unparseable += 1;
      console.log(`  ${snippet.id}: ${result.reason}`);
      continue;
    }
    if (result.code === snippet.code) {
      continue;
    }
    const from = escapeTemplate(snippet.code);
    const to = escapeTemplate(result.code);
    const source = sources.find(({ name }) => contents.get(name).includes(from));
    if (source == null) {
      failed += 1;
      console.log(`  ${snippet.id}: could not find its literal in any source file`);
      continue;
    }
    contents.set(source.name, contents.get(source.name).replace(from, to));
    fixed += 1;
  }
  changed += fixed;
  console.log(
    `${set.syntax}: ${fixed} reformatted, ${unparseable} unparseable, ` +
      `${set.snippets.length} total`,
  );
}

for (const { name, path } of sources) {
  const text = contents.get(name);
  if (text !== readFileSync(path, "utf8")) {
    writeFileSync(path, text);
  }
}

console.log(`\n${changed} snippets rewritten, ${failed} could not be located`);
process.exit(failed > 0 ? 1 : 0);
