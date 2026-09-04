// What is still English in one locale, as a patch skeleton to fill in.
//
//   node scripts/i18n-todo.mjs de              → prints id/English pairs
//   node scripts/i18n-todo.mjs de out.json     → writes them as JSON
//
// The companion to apply-translations.mjs: that one validates and merges a
// finished batch, this one says what the batch should contain. Kept separate
// so the thing that decides what is missing can never be the thing that
// decides a translation is good enough.
//
// A message with no letters in it (a bare number, a lone symbol) is skipped:
// there is nothing in it to translate, and putting it in the batch invites
// somebody to "translate" punctuation.
//
// One thing this count can never reach is zero, and it is not a bug.
// `translate.js` drops any translation identical to the English, so a word a
// language genuinely shares with it — Version, Premium, Admin, Alphabet,
// Cookies, Avatar, PIN, a person's name — reappears here after every sync.
// Those render correctly through the English fallback, which is the right
// word in that language. Read the remainder, do not just count it: a locale
// is finished when what is left is only words a translator would have left
// alone anyway.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "packages/keylearn-intl/translations";
const [locale, out] = process.argv.slice(2);

if (locale == null) {
  console.error("usage: i18n-todo.mjs <locale> [out.json]");
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const value = (v) => (typeof v === "string" ? v : (v?.defaultMessage ?? null));

const en = read(`${DIR}/en.json`);
let mine = {};
try {
  mine = read(`${DIR}/${locale}.json`);
} catch {
  // A locale with no file yet is entirely untranslated, which is a valid
  // starting point rather than an error — eo, fo, ga and zh-tw are in
  // exactly that state.
}

const todo = {};
let skipped = 0;
for (const [id, raw] of Object.entries(en)) {
  const english = value(raw);
  if (english == null || english === "") {
    continue;
  }
  if (value(mine[id])) {
    continue;
  }
  if (!/\p{L}/u.test(english)) {
    skipped += 1;
    continue;
  }
  todo[id] = english;
}

const ids = Object.keys(todo);
const words = ids.reduce((n, id) => n + todo[id].split(/\s+/).length, 0);

if (out != null) {
  writeFileSync(out, `${JSON.stringify(todo, null, 2)}\n`);
  console.error(`${locale}: ${ids.length} messages, ~${words} words → ${out}`);
} else {
  console.log(JSON.stringify(todo, null, 2));
  console.error(
    `${locale}: ${ids.length} messages, ~${words} words${skipped > 0 ? `, ${skipped} skipped (no letters)` : ""}`,
  );
}
