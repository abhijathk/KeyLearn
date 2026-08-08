// Forces the strings that are English on purpose back to English, everywhere.
//
// Two rules, both decided deliberately:
//
//   Theme names are names. "Amethyst", "Home Row", "Sepia" — they identify a
//   theme the way "KeyLearn" identifies the app, and a learner who picks
//   Cerulean should find Cerulean on any device in any language.
//
//   The kids trail is written, not translated. Its coach speaks recorded
//   English, its voice is Skelty and the big go and the dino, and a child
//   reading half of it in one language and half in another is worse served
//   than one reading all of it in English.
//
// Run after any bulk translation, and before compiling:
//
//   node scripts/english-by-design.mjs

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "packages/keylearn-intl/translations";
const en = JSON.parse(readFileSync(join(DIR, "en.json"), "utf8"));

const THEME_NAMES = [
  "theme.amethyst", "theme.bottomRow", "theme.bubblegum", "theme.cerulean",
  "theme.crimson", "theme.custom", "theme.dinoBlue", "theme.ember",
  "theme.grape", "theme.homeRow", "theme.keylearn", "theme.persimmon",
  "theme.sepia", "theme.spaceBar", "theme.sunbeam", "theme.topRow",
  "theme.trailGreen",
];

/**
 * `profiles.kid` is deliberately absent: it is the "Kid" chip on the grown-up's
 * own learner list, not anything a child reads.
 */
const kidFacing = Object.keys(en).filter(
  (id) =>
    (/^kids\./.test(id) || /\.kid$/.test(id) || /\.kid\./.test(id)) &&
    id !== "profiles.kid",
);

const FORCED = [...new Set([...THEME_NAMES, ...kidFacing, "t_Pick"])].filter(
  (id) => id in en,
);

let touched = 0;
for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".json") || file.includes("-merged") || file === "en.json") {
    continue;
  }
  const path = join(DIR, file);
  const t = JSON.parse(readFileSync(path, "utf8"));
  let n = 0;
  for (const id of FORCED) {
    if (t[id] !== en[id]) {
      t[id] = en[id];
      n++;
    }
  }
  if (n > 0) {
    const sorted = Object.fromEntries(
      Object.keys(t).sort().map((id) => [id, t[id]]),
    );
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`${file.replace(".json", "").padEnd(8)} ${n}`);
    touched += n;
  }
}
console.log(`\n${FORCED.length} ids held in English · ${touched} value(s) reset`);
