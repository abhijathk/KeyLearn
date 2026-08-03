import { TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { reactTsx } from "./react-tsx.ts";

/**
 * React, in TypeScript, formatted by Prettier.
 *
 * TSX rather than plain JSX: nearly every React codebase started since about
 * 2020 is typed, and the type annotations are a large part of what there is to
 * learn about writing a component well.
 */
export const react: SnippetSet = {
  syntax: "react_tsx",
  framework: "React",
  language: "TypeScript",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "typescript"],
    extension: ".tsx",
  },
  lineComment: ["//"],
  lexicon: TYPESCRIPT,
  topics: [
    { id: "component", name: "Components" },
    { id: "jsx", name: "JSX" },
    { id: "hooks", name: "Hooks" },
    { id: "state", name: "State" },
    { id: "effect", name: "Effects" },
    { id: "forms", name: "Forms" },
    { id: "performance", name: "Performance" },
  ],
  snippets: reactTsx,
};
