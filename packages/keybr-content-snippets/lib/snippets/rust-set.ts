import { RUST } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { rustLang } from "./rust-lang.ts";

/**
 * Rust, checked by rustfmt.
 *
 * rustfmt has almost nothing to configure and effectively every Rust project
 * uses it unmodified, which makes this the least arguable standard in the
 * package: there is one way Rust is laid out, and this is it.
 *
 * Like Java, Rust will not parse a bare statement at the top of a file, so the
 * snippets that are statements rather than items say so and the gate wraps
 * them in a function before formatting.
 */
export const rust: SnippetSet = {
  syntax: "rust_code",
  framework: "Rust",
  language: "Rust",
  standard: "rustfmt",
  formatter: {
    command: "rustfmt",
    args: ["--emit", "stdout", "--edition", "2021", "--quiet"],
    extension: ".rs",
    wrap: {
      statement: { before: "fn snippet() {", after: "}", indent: "    " },
    },
  },
  lineComment: ["//"],
  lexicon: RUST,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "ownership", name: "Ownership & borrowing" },
    { id: "types", name: "Structs & enums" },
    { id: "matching", name: "Pattern matching" },
    { id: "errors", name: "Option, Result & errors" },
    { id: "traits", name: "Traits & generics" },
    { id: "iterators", name: "Iterators" },
    { id: "collections", name: "Collections" },
    { id: "testing", name: "Tests" },
  ],
  snippets: rustLang,
};
