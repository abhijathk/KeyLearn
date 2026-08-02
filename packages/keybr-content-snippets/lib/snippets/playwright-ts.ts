import { TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { actions } from "./playwright-actions.ts";
import { api } from "./playwright-api.ts";
import { assertions } from "./playwright-assertions.ts";
import { config } from "./playwright-config.ts";
import {
  playwrightJavascript,
  TYPESCRIPT_ONLY,
} from "./playwright-javascript.ts";
import { locators } from "./playwright-locators.ts";
import { network } from "./playwright-network.ts";
import { structure } from "./playwright-structure.ts";

/**
 * Playwright in TypeScript, formatted the way Prettier leaves it.
 *
 * Prettier rather than a hand-rolled house style because it is what the
 * Playwright project itself uses, what almost every TypeScript repository
 * uses, and — the part that matters here — because it can be run over these
 * snippets in CI to prove they really are formatted the way they claim to be.
 *
 * Single quotes rather than Prettier's default, because that is the setting
 * the Playwright repository uses and therefore what every example a learner
 * meets in the documentation looks like. Matching the docs is worth more here
 * than matching the default.
 *
 * Ordered roughly the way the API is learned: find something, do something to
 * it, say what should be true, then the structure and configuration that turn
 * a handful of tests into a suite.
 */
export const playwrightTs: SnippetSet = {
  syntax: "playwright_ts",
  framework: "Playwright",
  language: "TypeScript",
  standard: "Prettier (Playwright style)",
  formatter: {
    command: "prettier",
    args: ["--parser", "typescript", "--single-quote"],
    extension: ".ts",
  },
  lineComment: ["//"],
  lexicon: TYPESCRIPT,
  topics: [
    { id: "locator", name: "Locators" },
    { id: "action", name: "Actions" },
    { id: "assertion", name: "Assertions" },
    { id: "structure", name: "Tests & fixtures" },
    { id: "network", name: "Network & mocking" },
    { id: "api", name: "API testing" },
    { id: "config", name: "Config & auth" },
  ],
  snippets: [
    ...locators,
    ...actions,
    ...assertions,
    ...structure,
    ...network,
    ...api,
    ...config,
  ],
};

/**
 * The same corpus in JavaScript.
 *
 * All but eight of the snippets above are already valid JavaScript, so they
 * are shared rather than copied: a second set of a hundred and thirty-nine
 * identical files would double the corpus to teach nothing, and would drift
 * the first time one of them was corrected in only one place.
 *
 * The eight that do use type annotations are swapped for JavaScript versions,
 * and two more are added for the JSDoc annotations that give an editor the
 * same help a type would — which is the part of writing Playwright in
 * JavaScript that is actually worth learning.
 */
export const playwrightJs: SnippetSet = {
  ...playwrightTs,
  syntax: "playwright_js",
  language: "JavaScript",
  formatter: {
    command: "prettier",
    args: ["--parser", "babel", "--single-quote"],
    extension: ".js",
  },
  snippets: [
    ...playwrightTs.snippets.filter(({ id }) => !TYPESCRIPT_ONLY.includes(id)),
    ...playwrightJavascript,
  ],
};
