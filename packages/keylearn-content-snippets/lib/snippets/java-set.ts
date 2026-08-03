import { JAVA } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { javaLang } from "./java-lang.ts";

/**
 * Java itself, checked by google-java-format.
 *
 * The one Java style with nothing left to argue about — it has no options —
 * which is why it has spread a long way beyond Google. Two spaces, 100
 * columns, and exactly one way to break a long expression.
 *
 * Same wrappers as the Selenium corpus: Java has no top-level statements, so a
 * snippet that is a run of statements is put inside a method before the
 * formatter sees it and taken back out afterwards.
 */
export const java: SnippetSet = {
  syntax: "java_code",
  framework: "Java",
  language: "Java",
  standard: "Google Java Style",
  formatter: {
    command: "google-java-format",
    args: ["--skip-removing-unused-imports", "-"],
    extension: ".java",
    wrap: {
      member: { before: "class Snippet {", after: "}", indent: "  " },
      statement: {
        before: "class Snippet {\n  void snippet() throws Exception {",
        after: "  }\n}",
        indent: "    ",
      },
    },
  },
  lineComment: ["//"],
  lexicon: JAVA,
  topics: [
    { id: "basics", name: "Language basics" },
    { id: "types", name: "Records & classes" },
    { id: "patterns", name: "Pattern matching" },
    { id: "nullability", name: "Optional & nulls" },
    { id: "streams", name: "Streams" },
    { id: "collections", name: "Collections" },
    { id: "errors", name: "Exceptions" },
    { id: "generics", name: "Generics & lambdas" },
    { id: "concurrency", name: "Concurrency" },
  ],
  snippets: javaLang,
};
