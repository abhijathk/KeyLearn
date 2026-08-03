import { TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { regexLang } from "./regex-lang.ts";

/**
 * Regular expressions, checked by Prettier.
 *
 * Regex has no formatter of its own and no style guide, so a corpus of bare
 * patterns could not be verified by anything. Written as JavaScript
 * declarations they can be — and the check is stronger than a formatting one,
 * because Prettier's parser rejects a pattern that is not a valid regular
 * expression in the first place.
 *
 * Naming them is also the lesson. A pattern assigned to a well-named constant
 * is readable; the same pattern inline in a condition is why regular
 * expressions have the reputation they have.
 */
export const regex: SnippetSet = {
  syntax: "regex_code",
  framework: "Regex",
  language: "JavaScript",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "babel"],
    extension: ".js",
  },
  lineComment: ["//"],
  lexicon: TYPESCRIPT,
  topics: [
    { id: "basics", name: "Patterns & quantifiers" },
    { id: "groups", name: "Groups & captures" },
    { id: "lookaround", name: "Lookahead & lookbehind" },
    { id: "flags", name: "Flags & Unicode" },
    { id: "using", name: "Matching, replacing & pitfalls" },
  ],
  snippets: regexLang,
};
