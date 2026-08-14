// Finds user-facing English that never goes through react-intl.
//
// A string sitting directly in JSX, or in a placeholder/title/aria-label, is
// invisible to the whole translation pipeline: it is not in en.json, so no
// locale can carry it, and no amount of translating fixes it. The page then
// renders half in the reader's language and half in English — which is how the
// security pane looked in Malayalam, and how the course pane looked in Tamil.
//
// Heuristic by necessity. It looks for text that reads like a sentence or a
// label meant for a person, and ignores the machinery around it.
//
//   node scripts/check-untranslated.mjs               # everything
//   node scripts/check-untranslated.mjs page-account  # one package

import { globSync, readFileSync } from "node:fs";

const only = process.argv.slice(2);

// Attributes a person actually reads.
const SPOKEN_ATTRS = ["placeholder", "title", "aria-label", "alt", "label"];

/** Words no user-facing sentence is made only of. */
const CODEISH =
  /^(true|false|null|undefined|none|auto|button|submit|text|password|email|number|tel|url|search|checkbox|radio|div|span|img|svg|utf-8|nowrap|off|on|polite|assertive|dialog|region|group|list|listitem|presentation|img|application)$/i;

/**
 * Does this look like something written for a person to read?
 *
 * Two or more words with a lower-case letter somewhere, or a single
 * capitalised word long enough to be a label rather than an enum value.
 */
function looksHuman(text) {
  const s = text.trim();
  if (s.length < 3 || s.length > 400) return false;
  if (CODEISH.test(s)) return false;
  if (!/[a-z]/.test(s)) return false; // SCREAMING_CASE, css values
  if (/^[a-z][\w-]*$/.test(s)) return false; // a lone identifier
  if (/^[#.$/{[]/.test(s)) return false; // selectors, paths, template bits
  if (/^\d/.test(s)) return false;
  // Source that merely happens to sit between a `>` and a `<`: generics,
  // arrow functions, statements. Prose does not contain these.
  if (/[;={}()[\]]|=>|\+\+|&&|\|\||::/.test(s)) return false;
  if (/\b(useState|useRef|useMemo|const|return|import|export|function|null|undefined)\b/.test(s)) {
    return false;
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return /^[A-Za-z“”'’(]/.test(s) && /[A-Za-z]{2,}/.test(s);
  return /^[A-Z][a-z]{3,}$/.test(s); // "Cancel", "Settings"
}

/**
 * Surfaces that are English on purpose.
 *
 * The kids trail is one of them. It is a game a child plays out loud with a
 * grown-up beside them, its coach speaks with recorded English audio, and its
 * whole voice — Skelty, the big go, the dino — is written rather than
 * translated. Half-translating it would be worse than leaving it alone, so it
 * is excluded here rather than reported for ever as 75 faults.
 *
 * The crash screen and the server error page are the other two. Both are the
 * fallback that renders when something else has already gone wrong —
 * ErrorScreen is a React error boundary that can be reached by a failure
 * anywhere in the tree, including the locale loader itself, and ErrorPage is
 * the server's last-resort handler for the same reason (hence its hard-coded
 * `lang="en"`). Making either depend on react-intl risks the one screen that
 * exists to survive a crash failing to render at all. Confirmed, not assumed:
 * ErrorScreen.tsx says so in its own doc comment, and REPORT_ERRORS (the only
 * env var gating the debug.tsx toast) does not appear in webpack.config.js,
 * so that branch never fires in the browser bundle either.
 */
const ENGLISH_BY_DESIGN = [
  "packages/page-kids/",
  "packages/keylearn-debug/lib/ErrorScreen.tsx",
  "packages/keylearn-pages-server/lib/ErrorPage.tsx",
  "packages/keylearn-result-loader/lib/internal/debug.tsx",
];

const files = globSync("packages/*/lib/**/*.tsx").filter(
  (f) =>
    !f.includes(".test.") &&
    !ENGLISH_BY_DESIGN.some((p) => f.includes(p)) &&
    (only.length === 0 || only.some((p) => f.includes(`packages/${p}/`))),
);

let found = 0;
const byFile = {};

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // Everything inside a FormattedMessage/formatMessage call is already handled;
  // blanking them out stops their defaultMessage being reported.
  const masked = src
    .replace(/defaultMessage:\s*(["'`])(?:\\.|(?!\1)[\s\S])*\1/g, "defaultMessage:''")
    // A braced expression, which is how a message long enough to be split into
    // `"…" + "…"` over several lines is written. extract-messages folds those
    // into en.json, but the rule below only reaches a quote sitting flush
    // against the brace, so the paragraphs read as loose JSX prose instead.
    .replace(/defaultMessage=\{(?:[^{}]|\{[^{}]*\})*\}/g, "defaultMessage=''")
    .replace(/defaultMessage=\{?(["'`])(?:\\.|(?!\1)[\s\S])*\1\}?/g, "defaultMessage=''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  const hits = [];

  // Text sitting between tags. Prose in JSX is wrapped across lines by the
  // formatter, so the newlines are folded away before it is judged — the
  // first version anchored on a non-newline and so missed every paragraph,
  // which is the shape most of the real prose takes.
  for (const m of masked.matchAll(/>([^<>{}]+)</g)) {
    const text = m[1].replace(/\s+/g, " ");
    if (looksHuman(text)) {
      hits.push({ at: m.index, kind: "jsx text", text: text.trim() });
    }
  }
  // Attributes a person reads.
  for (const attr of SPOKEN_ATTRS) {
    const re = new RegExp(`\\b${attr}=(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
    for (const m of masked.matchAll(re)) {
      if (looksHuman(m[2])) {
        hits.push({ at: m.index, kind: attr, text: m[2].trim() });
      }
    }
  }

  if (hits.length > 0) {
    const lineOf = (at) => masked.slice(0, at).split("\n").length;
    byFile[file] = hits
      .map((h) => ({ ...h, line: lineOf(h.at) }))
      .sort((a, b) => a.line - b.line);
    found += hits.length;
  }
}

const entries = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
for (const [file, hits] of entries) {
  console.log(`\n${file}  (${hits.length})`);
  for (const h of hits.slice(0, 12)) {
    console.log(`  ${String(h.line).padStart(4)}  ${h.kind}: ${JSON.stringify(h.text).slice(0, 96)}`);
  }
  if (hits.length > 12) console.log(`  … and ${hits.length - 12} more`);
}
console.log(`\n${found} string(s) in ${entries.length} file(s) never reach a translation file`);
if (found > 0) process.exitCode = 1;
