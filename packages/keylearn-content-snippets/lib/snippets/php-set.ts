import { PHP } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { phpLang } from "./php-lang.ts";

/**
 * PHP, checked by Prettier's PHP plugin on PSR-12.
 *
 * PSR-12 is what Composer packages follow and what every framework's own
 * standard is derived from — four spaces, the brace on its own line for a
 * class or function and on the same line for everything else.
 *
 * Every snippet is a fragment inside an opening tag rather than a whole file,
 * so the wrapper supplies the `<?php` and the gate takes it back off. That
 * keeps a snippet about named arguments to three lines instead of five.
 */
export const php: SnippetSet = {
  syntax: "php_code",
  framework: "PHP",
  language: "PHP",
  standard: "PSR-12",
  formatter: {
    command: "prettier",
    args: ["--plugin=@prettier/plugin-php", "--parser", "php"],
    extension: ".php",
    wrap: {
      statement: { before: "<?php", after: "", indent: "" },
      member: {
        before: "<?php\n\nclass Snippet\n{",
        after: "}",
        indent: "    ",
      },
    },
  },
  lineComment: ["//", "#"],
  lexicon: PHP,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "types", name: "Classes, enums & interfaces" },
    { id: "functions", name: "Functions & closures" },
    { id: "collections", name: "Arrays" },
    { id: "errors", name: "Errors & safety" },
    { id: "database", name: "Databases" },
    { id: "testing", name: "Tests" },
  ],
  snippets: phpLang,
};
