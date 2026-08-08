// Merges a batch of translations into one locale's file.
//
//   node scripts/apply-translations.mjs hi patch.json
//
// Refuses anything that would not render: an id English does not have, a
// string whose arguments do not match the English, or one that will not parse.
// Translating happens in batches of a few hundred, and a single bad brace in
// the middle of one is otherwise found much later, by a learner.
//
// Existing translations are never overwritten — a batch only fills blanks, so
// re-running it is safe and a human correction always wins.

import { parse } from "@formatjs/icu-messageformat-parser";
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "packages/keylearn-intl/translations";
const [locale, patchPath] = process.argv.slice(2);

if (locale == null || patchPath == null) {
  console.error("usage: apply-translations.mjs <locale> <patch.json>");
  process.exit(2);
}

const TAG = 8;
const LITERAL = 0;
const POUND = 7;

function shapeOf(ast, out = { args: new Set(), tags: new Set() }) {
  for (const node of ast) {
    if (node.type === TAG) {
      out.tags.add(node.value);
    } else if (node.type !== LITERAL && node.type !== POUND && node.value != null) {
      out.args.add(node.value);
    }
    if (node.options != null) {
      for (const arm of Object.values(node.options)) shapeOf(arm.value, out);
    }
    if (Array.isArray(node.children)) shapeOf(node.children, out);
  }
  return out;
}

const en = JSON.parse(readFileSync(`${DIR}/en.json`, "utf8"));
const current = JSON.parse(readFileSync(`${DIR}/${locale}.json`, "utf8"));
const patch = JSON.parse(readFileSync(patchPath, "utf8"));

const rejected = [];
let added = 0;
let skipped = 0;

for (const [id, value] of Object.entries(patch)) {
  if (!(id in en)) {
    rejected.push(`${id}: not an English id`);
    continue;
  }
  if (typeof current[id] === "string" && current[id].trim() !== "") {
    skipped++;
    continue;
  }
  if (typeof value !== "string" || value.trim() === "") {
    rejected.push(`${id}: empty`);
    continue;
  }
  let want;
  let got;
  try {
    want = shapeOf(parse(en[id]));
    got = shapeOf(parse(value));
  } catch (err) {
    rejected.push(`${id}: will not parse — ${err.message.split("\n")[0]}`);
    continue;
  }
  const missing = [...want.args].filter((a) => !got.args.has(a));
  const extra = [...got.args].filter((a) => !want.args.has(a));
  const lostTags = [...want.tags].filter((t) => !got.tags.has(t));
  if (missing.length || extra.length || lostTags.length) {
    rejected.push(
      `${id}:${missing.length ? ` dropped {${missing.join("}, {")}}` : ""}` +
        `${extra.length ? ` invented {${extra.join("}, {")}}` : ""}` +
        `${lostTags.length ? ` lost <${lostTags.join(">, <")}>` : ""}`,
    );
    continue;
  }
  current[id] = value;
  added++;
}

// Sorted, so a diff between two batches is readable.
const sorted = Object.fromEntries(
  Object.keys(current).sort().map((id) => [id, current[id]]),
);
writeFileSync(`${DIR}/${locale}.json`, `${JSON.stringify(sorted, null, 2)}\n`);

const total = Object.keys(en).length;
const have = Object.keys(en).filter(
  (id) => typeof current[id] === "string" && current[id].trim() !== "",
).length;

console.log(`${locale}: +${added} added, ${skipped} already there, ${rejected.length} rejected`);
console.log(`${locale}: ${have}/${total} translated, ${total - have} to go`);
for (const line of rejected) console.log(`  REJECTED ${line}`);
if (rejected.length > 0) process.exitCode = 1;
