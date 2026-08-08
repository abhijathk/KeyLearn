// Checks every translation against the English it stands in for.
//
// A translated string is not free text: it carries ICU markup that the runtime
// depends on. `{name}` missing from a Latvian string renders a blank where a
// learner's name should be; a `plural` arm renamed to something react-intl
// does not know throws at render and takes the page with it. None of that is
// visible in a diff of two scripts nobody on the team reads, so it is checked
// here instead.
//
// Structure only. Whether the words are right is a question for a person who
// speaks the language; whether the string can render at all is a question with
// an answer, and this is it.
//
//   node scripts/check-translations.mjs            # every locale
//   node scripts/check-translations.mjs hi ml      # just these

import { parse } from "@formatjs/icu-messageformat-parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "packages/keylearn-intl/translations";
const only = process.argv.slice(2);

const read = (file) => JSON.parse(readFileSync(join(DIR, file), "utf8"));

const TAG = 8;
const LITERAL = 0;
const POUND = 7;

/**
 * Every argument and rich-text tag the message refers to, however deeply
 * nested.
 *
 * Parsed rather than pattern-matched. The first version of this walked the
 * braces, which cannot tell an argument from the text inside a plural arm:
 * `{lessons, plural, one {les} other {lesse}}` is one argument and two
 * Afrikaans words, and reading it flat reports two invented placeholders and
 * a dropped one on a string that is perfectly correct. It accused 228 sound
 * translations before the parser replaced it.
 */
function argumentsOf(ast, out = { args: new Set(), tags: new Set() }) {
  for (const node of ast) {
    if (node.type === TAG) {
      out.tags.add(node.value);
    } else if (node.type !== LITERAL && node.type !== POUND && node.value != null) {
      out.args.add(node.value);
    }
    if (node.options != null) {
      for (const arm of Object.values(node.options)) {
        argumentsOf(arm.value, out);
      }
    }
    if (Array.isArray(node.children)) {
      argumentsOf(node.children, out);
    }
  }
  return out;
}

const en = read("en.json");
const ids = Object.keys(en);
const locales = readdirSync(DIR)
  .filter((f) => f.endsWith(".json") && !f.includes("-merged") && f !== "en.json")
  .map((f) => f.replace(".json", ""))
  .filter((l) => only.length === 0 || only.includes(l));

let problems = 0;
const unstyled = [];
const status = [];

for (const locale of locales) {
  const t = read(`${locale}.json`);
  let translated = 0;
  for (const id of ids) {
    const value = t[id];
    if (typeof value !== "string" || value.trim() === "") continue;
    translated++;

    let want;
    let got;
    try {
      want = argumentsOf(parse(en[id]));
      got = argumentsOf(parse(value));
    } catch (err) {
      // A string react-intl cannot parse throws at render time, taking the
      // page with it — the worst outcome of the three checked here.
      console.log(`${locale}/${id}: will not parse — ${err.message.split("\n")[0]}`);
      problems++;
      continue;
    }
    // A dropped argument leaves a blank where a name or a number belongs, and
    // an invented one renders the literal braces. Both are breakage.
    const missing = [...want.args].filter((p) => !got.args.has(p));
    const extra = [...got.args].filter((p) => !want.args.has(p));
    if (missing.length > 0) {
      console.log(`${locale}/${id}: dropped {${missing.join("}, {")}}`);
      problems++;
    }
    if (extra.length > 0) {
      console.log(`${locale}/${id}: invented {${extra.join("}, {")}}`);
      problems++;
    }
    // A dropped tag still renders — it just renders flat, losing whatever the
    // tag was carrying. Counted apart from breakage because it is a
    // difference in finish, not a fault.
    const lostTags = [...want.tags].filter((p) => !got.tags.has(p));
    if (lostTags.length > 0) {
      unstyled.push(`${locale}/${id}: no <${lostTags.join(">, <")}>`);
    }
  }
  // An id the English no longer has is dead weight the compiler ignores, but
  // it hides how much is really translated, so it is worth saying.
  const stale = Object.keys(t).filter((id) => !(id in en));
  status.push({ locale, translated, missing: ids.length - translated, stale: stale.length });
}

status.sort((a, b) => b.missing - a.missing);
console.log("\nlocale   translated  missing  stale");
for (const s of status) {
  console.log(
    `${s.locale.padEnd(8)} ${String(s.translated).padStart(9)} ${String(s.missing).padStart(8)} ${String(s.stale).padStart(6)}`,
  );
}
const totalMissing = status.reduce((n, s) => n + s.missing, 0);
console.log(`\n${ids.length} ids · ${status.length} locales · ${totalMissing} strings still to translate`);

if (unstyled.length > 0) {
  // Not a failure. These render, only without the emphasis the English has.
  const byId = {};
  for (const line of unstyled) {
    const id = line.split("/").slice(1).join("/").split(":")[0];
    byId[id] = (byId[id] || 0) + 1;
  }
  console.log(`\n${unstyled.length} translations drop a rich-text tag (they render, unemphasised):`);
  for (const [id, n] of Object.entries(byId).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id} — ${n} locales`);
  }
}

if (problems > 0) {
  console.log(`\n${problems} structural problem(s)`);
  process.exitCode = 1;
}
