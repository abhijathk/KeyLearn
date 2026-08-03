import { type Snippet } from "../types.ts";

/**
 * Regular expressions, as named JavaScript constants.
 *
 * Regex has no formatter and no style guide, so a bare pattern could not be
 * checked by anything. Written as a JavaScript declaration it can be: Prettier
 * gates the layout, and its parser rejects a pattern that is not a valid
 * regular expression — which is a stronger guarantee than a corpus of loose
 * patterns could ever offer.
 *
 * Naming them is also the habit worth teaching. A regex assigned to a
 * well-named constant is readable; the same regex inline in a condition is the
 * reason regular expressions have the reputation they do.
 */
export const regexLang: readonly Snippet[] = [
  {
    id: "re-anchors",
    title: "Anchors, and why they are not optional",
    level: 1,
    tags: ["basics"],
    code: `// Without ^ and $ this matches a SKU anywhere inside a longer string, so
// "xxAB-12yy" passes. Almost every validation regex needs both.
const SKU = /^[A-Z]{2}-\\d{2}$/;`,
  },
  {
    id: "re-classes",
    title: "Character classes",
    level: 1,
    tags: ["basics"],
    code: `// A dash between two characters is a range; a dash at either end is a
// literal dash. Getting that backwards is the classic first mistake.
const HEX = /^[0-9a-fA-F]+$/;
const SLUG = /^[a-z0-9-]+$/;`,
  },
  {
    id: "re-shorthand",
    title: "The shorthand classes, and their negations",
    level: 1,
    tags: ["basics"],
    code: `// \\d is a digit, \\w is a word character, \\s is whitespace. The capital is
// the negation of each, which is often the shorter way to say it.
const DIGITS_ONLY = /^\\d+$/;
const NO_WHITESPACE = /^\\S+$/;`,
  },
  {
    id: "re-quantifiers",
    title: "The quantifiers",
    level: 2,
    tags: ["basics"],
    code: `// ? is zero or one, * is zero or more, + is one or more. The braces give
// an exact count or a range, and an open range needs the trailing comma.
const OPTIONAL_PROTOCOL = /^(https?:\\/\\/)?/;
const AU_POSTCODE = /^\\d{4}$/;
const PASSWORD = /^.{8,64}$/;`,
  },
  {
    id: "re-greedy-lazy",
    title: "Greedy, and lazy",
    level: 3,
    tags: ["basics"],
    code: `// The first .* runs to the last quote in the line; the .*? stops at the
// first. This one difference accounts for most "why did it match all that".
const GREEDY = /".*"/;
const LAZY = /".*?"/;`,
  },
  {
    id: "re-alternation",
    title: "Alternation, and where the brackets go",
    level: 2,
    tags: ["basics"],
    code: `// Alternation has the lowest precedence of anything, so without the
// group this would mean "^GET" or "POST" or "PUT$" — three different things.
const METHOD = /^(GET|POST|PUT|DELETE)$/;`,
  },
  {
    id: "re-escape",
    title: "Escaping, and what needs it",
    level: 2,
    tags: ["basics"],
    code: `// A dot matches any character until it is escaped. Inside a class most
// metacharacters lose their meaning, so the dot there needs no backslash.
const FILENAME = /^[\\w.-]+\\.(?:jpe?g|png|webp)$/i;`,
  },
  {
    id: "re-groups",
    title: "Capturing, and not capturing",
    level: 3,
    tags: ["groups"],
    code: `// (?: ) groups without capturing, so the numbered groups stay meaningful.
// Every unnecessary capture shifts the ones after it.
const DURATION = /^(\\d+)(?:h|m|s)$/;`,
  },
  {
    id: "re-named-groups",
    title: "Named capture groups",
    level: 3,
    tags: ["groups"],
    code: `// The match arrives with a groups object, so the fields are read by name
// rather than by an index that changes when the pattern does.
const ISO_DATE = /^(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})$/;`,
  },
  {
    id: "re-named-use",
    title: "Using the named groups",
    level: 3,
    tags: ["groups"],
    code: `// Note the null check: match returns null when nothing matched, and
// destructuring straight from it is a TypeError waiting to happen.
const match = ISO_DATE.exec(input);
if (match?.groups !== undefined) {
  const { year, month, day } = match.groups;
}`,
  },
  {
    id: "re-backreference",
    title: "A back-reference",
    level: 4,
    tags: ["groups"],
    code: `// \\1 matches whatever the first group actually matched, so this finds a
// word repeated — the classic "the the" in prose.
const DOUBLED_WORD = /\\b(\\w+)\\s+\\1\\b/i;`,
  },
  {
    id: "re-lookahead",
    title: "A positive lookahead",
    level: 4,
    tags: ["lookaround"],
    code: `// Each lookahead asserts without consuming, so all four are checked from
// the same starting position. This is how a password policy is expressed.
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{12,}$/;`,
  },
  {
    id: "re-negative-lookahead",
    title: "A negative lookahead",
    level: 4,
    tags: ["lookaround"],
    code: `// "starts with a letter and is not one of these reserved names". The
// alternative is a check in code, which is often the clearer choice.
const USERNAME = /^(?!admin$|root$)[a-z][a-z0-9_]{2,31}$/;`,
  },
  {
    id: "re-lookbehind",
    title: "A lookbehind",
    level: 5,
    tags: ["lookaround"],
    code: `// Matches the number after the currency symbol without including it in
// the result, so no group needs to be pulled out afterwards.
const AMOUNT = /(?<=\\$)\\d+(?:\\.\\d{2})?/g;`,
  },
  {
    id: "re-word-boundary",
    title: "Word boundaries",
    level: 3,
    tags: ["basics"],
    code: `// \\b is a position, not a character. Without it, this matches the "cat"
// inside "concatenate", which is rarely what a word search wants.
const WHOLE_WORD = /\\bcat\\b/i;`,
  },
  {
    id: "re-flags",
    title: "The flags worth knowing",
    level: 2,
    tags: ["flags"],
    code: `// i ignores case, g finds every match, m makes ^ and $ match at each
// line, s lets the dot match a newline, u turns on Unicode handling.
const HEADINGS = /^#{1,6} .+$/gm;
const ANY_CHARACTER = /<pre>.*?<\\/pre>/s;`,
  },
  {
    id: "re-global-lastindex",
    title: "The trap in the g flag",
    level: 5,
    tags: ["flags"],
    code: `// A global regex keeps lastIndex between calls, so test() on the same
// pattern alternates true and false. Never share a global regex, or reset it.
const HAS_DIGIT = /\\d/g;
HAS_DIGIT.lastIndex = 0;`,
  },
  {
    id: "re-unicode-property",
    title: "Match by Unicode property",
    level: 5,
    tags: ["flags"],
    code: `// \\p{L} is any letter in any script, which [a-zA-Z] is not. For anything
// a person's name goes into, this is the only correct answer.
const NAME = /^\\p{L}[\\p{L}\\p{M}'\\- ]{0,63}$/u;`,
  },
  {
    id: "re-match-all",
    title: "Every match, with its groups",
    level: 4,
    tags: ["using"],
    code: `// matchAll gives an iterator of full match objects, where match with the
// g flag throws the groups away and returns strings only.
for (const { groups } of text.matchAll(ISO_DATE_GLOBAL)) {
  console.log(groups?.year);
}`,
  },
  {
    id: "re-replace-function",
    title: "Replace with a function",
    level: 4,
    tags: ["using"],
    code: `// The replacer receives the match and each group, so the replacement can
// depend on what was found rather than being a fixed string.
const masked = text.replace(CARD_NUMBER, (match) => "*".repeat(match.length));`,
  },
  {
    id: "re-replace-named",
    title: "Reorder with named references",
    level: 4,
    tags: ["using"],
    code: `// The dollar-brace form refers to a named group, which survives the
// pattern being edited in a way that $1 and $2 do not.
const american = date.replace(ISO_DATE, "$<month>/$<day>/$<year>");`,
  },
  {
    id: "re-split",
    title: "Split on a pattern",
    level: 3,
    tags: ["using"],
    code: `// Splitting on one or more separators, with optional whitespace, so a
// trailing comma or a double space does not produce an empty field.
const parts = line.split(/\\s*[,;]\\s*/);`,
  },
  {
    id: "re-escape-input",
    title: "Escape user input before putting it in a pattern",
    level: 5,
    tags: ["using"],
    code: `// A search box that builds a regex from what was typed will break on a
// bracket and can be made to hang on a well-chosen string.
const escaped = query.replace(/[.*+?^\\\${}()|[\\]\\\\]/g, "\\\\$&");
const search = new RegExp(escaped, "gi");`,
  },
  {
    id: "re-catastrophic",
    title: "The pattern that hangs",
    level: 5,
    tags: ["using"],
    code: `// Nested quantifiers over overlapping classes backtrack exponentially:
// /(a+)+$/ on thirty a's and a b never finishes. Prefer a possessive shape
// or a plain character class.
const SAFE_REPEAT = /^[a-z]+$/;`,
  },
  {
    id: "re-multiline-source",
    title: "Build a long pattern from readable pieces",
    level: 5,
    tags: ["using"],
    code: `// A forty-character regex on one line is unreviewable. Composing it from
// named sources keeps each part legible and the whole one thing.
const YEAR = /\\d{4}/.source;
const MONTH = /\\d{2}/.source;
const DATE = new RegExp(\`^\${YEAR}-\${MONTH}$\`);`,
  },
  {
    id: "re-email-honest",
    title: "Do not validate an email with a regex",
    level: 4,
    tags: ["using"],
    code: `// The full grammar is famously unmatched by any readable pattern. Check
// it has one @ with something on each side, then send a confirmation — which
// is the only test that actually proves anything.
const PLAUSIBLE_EMAIL = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;`,
  },
  {
    id: "re-log-line",
    title: "Parse a log line",
    level: 4,
    tags: ["groups"],
    code: `// The shape a great many real regexes take: anchored, named groups, and
// a lazy match for the free-text part at the end.
const LOG = /^(?<time>\\S+) \\[(?<level>[A-Z]+)\\] (?<message>.+?)\\s*$/;`,
  },
];
