import { CPP } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { cppLang } from "./cpp-lang.ts";

/**
 * C and C++, checked by clang-format on the LLVM style.
 *
 * LLVM is clang-format's own default and what a project that has not chosen
 * otherwise ends up with — two-space indent, 80 columns, the brace on the same
 * line. Unlike its C# support, clang-format's C++ support is the reference
 * implementation: it is the same parser the compiler front end uses.
 *
 * Statements are wrapped in a function before formatting, since C++ has no
 * top-level statements either.
 */
export const cpp: SnippetSet = {
  syntax: "cpp_code",
  framework: "C/C++",
  language: "C++",
  standard: "clang-format (LLVM)",
  formatter: {
    command: "clang-format",
    args: ["--assume-filename=snippet.cpp", "--style=LLVM"],
    extension: ".cpp",
    wrap: {
      statement: { before: "void snippet() {", after: "}", indent: "  " },
    },
  },
  lineComment: ["//"],
  lexicon: CPP,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "ownership", name: "RAII & smart pointers" },
    { id: "types", name: "Structs, classes & enums" },
    { id: "collections", name: "Containers & algorithms" },
    { id: "templates", name: "Templates & concepts" },
    { id: "errors", name: "Exceptions" },
    { id: "structure", name: "Headers & namespaces" },
    { id: "c", name: "Plain C" },
  ],
  snippets: cppLang,
};
