import { CSHARP, SHELL } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { csharpLang } from "./csharp-lang.ts";
import { shellLang } from "./shell-lang.ts";

/**
 * C#, on Microsoft's conventions — Allman braces, four spaces.
 *
 * The gate is CSharpier, and it is not installed here: it needs a newer .NET
 * SDK than this machine has, so this corpus is currently unchecked.
 *
 * clang-format was tried first, since it does claim to format C# and is
 * already present. It is not fit for it. Given a switch expression it produced
 * this:
 *
 *     var band = total switch { <
 *                                   0m => "refund",
 *
 * — which is not merely ugly but not C#. Its parser predates switch
 * expressions, property patterns and list patterns, so on exactly the modern
 * syntax this corpus exists to teach it emits nonsense. A gate that rewrites
 * correct code into broken code is worse than no gate at all, so this one is
 * named honestly and left to skip until CSharpier can run.
 */
export const csharp: SnippetSet = {
  syntax: "csharp_code",
  framework: "C#",
  language: "C#",
  standard: "CSharpier",
  formatter: {
    command: "csharpier",
    args: ["format", "-"],
    extension: ".cs",
  },
  lineComment: ["//"],
  lexicon: CSHARP,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "nullability", name: "Nullable references" },
    { id: "types", name: "Records, classes & enums" },
    { id: "patterns", name: "Pattern matching" },
    { id: "linq", name: "LINQ & sequences" },
    { id: "async", name: "Async & cancellation" },
    { id: "errors", name: "Exceptions" },
    { id: "structure", name: "Structure & generics" },
    { id: "testing", name: "Tests" },
  ],
  snippets: csharpLang,
};

/**
 * Bash, checked by shfmt on the Google shell style guide's settings.
 *
 * Two-space indent, `then` and `do` on the same line as their condition, and
 * a space after every redirect operator. shfmt is not a standard the way
 * gofmt is, but it is the only formatter shell has, and it is what every
 * shell-aware CI reaches for.
 */
export const shell: SnippetSet = {
  syntax: "shell_code",
  framework: "Shell",
  language: "Bash",
  standard: "shfmt (Google style)",
  formatter: {
    command: "shfmt",
    args: ["--indent", "2", "--binary-next-line", "--case-indent", "-"],
    extension: ".sh",
  },
  lineComment: ["#"],
  lexicon: SHELL,
  topics: [
    { id: "basics", name: "Variables & expansion" },
    { id: "conditionals", name: "Tests & branching" },
    { id: "loops", name: "Loops & files" },
    { id: "functions", name: "Functions & arguments" },
    { id: "safety", name: "Safety & cleanup" },
  ],
  snippets: shellLang,
};
