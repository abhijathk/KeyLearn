import { KOTLIN, SWIFT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { kotlinLang } from "./kotlin-lang.ts";
import { swiftLang } from "./swift-lang.ts";

/**
 * Kotlin, checked by ktlint on the official code style.
 *
 * ktlint has two styles: `intellij_idea` and `ktlint_official`. The second is
 * the one JetBrains and the Kotlin team converged on, and it is the stricter —
 * it has opinions about expression bodies and trailing commas that the older
 * one leaves alone. Pinned in the repo's `.editorconfig` under `[*.kt]`.
 */
export const kotlin: SnippetSet = {
  syntax: "kotlin",
  framework: "Kotlin",
  language: "Kotlin",
  standard: "ktlint official",
  formatter: {
    command: "ktlint",
    args: ["--format", "--stdin", "--log-level=none"],
    extension: ".kt",
  },
  lineComment: ["//"],
  lexicon: KOTLIN,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "null", name: "Null safety" },
    { id: "types", name: "Data & sealed classes" },
    { id: "control", name: "when & control flow" },
    { id: "collections", name: "Collections" },
    { id: "idiom", name: "Scope functions & extensions" },
    { id: "errors", name: "Errors & preconditions" },
    { id: "coroutines", name: "Coroutines & flows" },
  ],
  snippets: kotlinLang,
};

/**
 * Swift, checked by Apple's own `swift-format`.
 *
 * Two-space indent and 100 columns are its defaults, and it ships inside the
 * command line tools — so unlike every other non-npm formatter here, this gate
 * runs on any Mac with Xcode installed and needs nothing fetched.
 */
export const swift: SnippetSet = {
  syntax: "swift",
  framework: "Swift",
  language: "Swift",
  standard: "swift-format",
  formatter: {
    command: "swift-format",
    args: ["format"],
    extension: ".swift",
  },
  lineComment: ["//"],
  lexicon: SWIFT,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "optionals", name: "Optionals" },
    { id: "types", name: "Structs & enums" },
    { id: "control", name: "Pattern matching" },
    { id: "protocols", name: "Protocols & generics" },
    { id: "collections", name: "Collections" },
    { id: "errors", name: "Error handling" },
    { id: "concurrency", name: "async/await & actors" },
    { id: "swiftui", name: "SwiftUI" },
  ],
  snippets: swiftLang,
};
