import { GO } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { goLang } from "./go-lang.ts";

/**
 * Go, checked by gofumpt.
 *
 * The least arguable standard in this package. gofmt shipped with the language
 * in 2009, every Go project runs it, and it has no options at all — which is
 * the reason Go code from any two teams looks the same.
 *
 * gofumpt is a strict superset: everything it produces gofmt accepts, and it
 * settles a handful of cases gofmt leaves to the author.
 */
export const go: SnippetSet = {
  syntax: "go_code",
  framework: "Go",
  language: "Go",
  standard: "gofumpt",
  formatter: {
    command: "gofumpt",
    args: [],
    extension: ".go",
    wrap: {
      // A tab, because that is what gofmt will put there.
      statement: {
        before: "package main\n\nfunc snippet() {",
        after: "}",
        indent: "\t",
      },
    },
  },
  lineComment: ["//"],
  lexicon: GO,
  // The one corpus that does, and the reason the rule is a property rather
  // than a blanket ban.
  indentsWithTabs: true,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "errors", name: "Errors" },
    { id: "types", name: "Structs & methods" },
    { id: "interfaces", name: "Interfaces" },
    { id: "collections", name: "Slices & maps" },
    { id: "concurrency", name: "Goroutines & channels" },
    { id: "stdlib", name: "Standard library" },
    { id: "testing", name: "Tests" },
  ],
  snippets: goLang,
};
