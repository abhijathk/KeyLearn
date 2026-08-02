import { TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { cypressJs } from "./cypress-js.ts";

/**
 * Cypress, in JavaScript, formatted by Prettier.
 *
 * JavaScript rather than TypeScript because that is still how most Cypress
 * suites are written — the framework's own docs and examples are in it, and
 * the chainable command types add friction without adding much safety.
 */
export const cypress: SnippetSet = {
  syntax: "cypress_js",
  framework: "Cypress",
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
    { id: "structure", name: "Suite structure" },
    { id: "locators", name: "Selecting elements" },
    { id: "actions", name: "Interactions" },
    { id: "assertions", name: "Assertions" },
    { id: "network", name: "Intercepts & stubs" },
    { id: "api", name: "API testing" },
    { id: "ui", name: "UI behaviour" },
  ],
  snippets: cypressJs,
};
