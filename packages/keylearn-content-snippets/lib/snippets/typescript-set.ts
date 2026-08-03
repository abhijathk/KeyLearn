import { TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { typescriptCode } from "./typescript-code.ts";
import { typescriptFunctions } from "./typescript-functions.ts";
import { typescriptTypes } from "./typescript-types.ts";

/**
 * TypeScript itself, rather than a framework written in it.
 *
 * The default Code craft corpus, and the largest — TypeScript is what most of
 * the rest of this package is written in, it is what the app itself is built
 * from, and it is the language a learner is most likely to be typing all day.
 *
 * Split into more topics than any other corpus on purpose. "TypeScript" is not
 * one subject: the type system, the generics, and the ordinary code that
 * carries the annotations are three different things to practise, and someone
 * drilling narrowing should not have utility types mixed in.
 *
 * Formatted by Prettier on its defaults — double quotes, 80 columns, trailing
 * commas — because that is what an unconfigured TypeScript repository looks
 * like, and the point is to build the habit that matches.
 */
export const typescript: SnippetSet = {
  syntax: "typescript_code",
  framework: "TypeScript",
  language: "TypeScript",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "typescript"],
    extension: ".ts",
  },
  lineComment: ["//"],
  lexicon: TYPESCRIPT,
  topics: [
    { id: "types", name: "Types & inference" },
    { id: "narrowing", name: "Unions & narrowing" },
    { id: "functions", name: "Functions" },
    { id: "generics", name: "Generics" },
    { id: "utility", name: "Utility types" },
    { id: "advanced", name: "Mapped & conditional types" },
    { id: "interfaces", name: "Interfaces & aliases" },
    { id: "classes", name: "Classes" },
    { id: "collections", name: "Arrays, maps & objects" },
    { id: "async", name: "Async & promises" },
    { id: "errors", name: "Errors" },
    { id: "modules", name: "Modules & declarations" },
  ],
  snippets: [...typescriptTypes, ...typescriptFunctions, ...typescriptCode],
};
