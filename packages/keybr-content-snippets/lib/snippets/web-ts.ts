import { CSS_LEX, HTML_LEX, TYPESCRIPT } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { webCss } from "./web-css.ts";
import { webHtml } from "./web-html.ts";
import { webJavascript } from "./web-javascript.ts";

/**
 * CSS, checked by Prettier.
 *
 * Prettier has almost nothing to configure for CSS and is what nearly every
 * front-end repository runs, which makes this one of the least arguable gates
 * here — there is one way it lays a rule out, and this is it.
 */
export const css: SnippetSet = {
  syntax: "css_code",
  framework: "CSS",
  language: "CSS",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "css"],
    extension: ".css",
  },
  lineComment: [],
  lexicon: CSS_LEX,
  topics: [
    { id: "basics", name: "Custom properties & colour" },
    { id: "layout", name: "Grid, flexbox & containers" },
    { id: "selectors", name: "Selectors & the cascade" },
    { id: "typography", name: "Typography" },
    { id: "motion", name: "Transitions & animation" },
    { id: "accessibility", name: "Accessibility" },
  ],
  snippets: webCss,
};

/**
 * HTML, checked by Prettier.
 *
 * Prettier's HTML output is whitespace-sensitive and occasionally
 * surprising — it will not reflow an inline element where doing so would
 * change the rendering — which is exactly the behaviour you want it to have,
 * and worth seeing while typing.
 */
export const html: SnippetSet = {
  syntax: "html_code",
  framework: "HTML",
  language: "HTML",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "html"],
    extension: ".html",
  },
  lineComment: [],
  lexicon: HTML_LEX,
  topics: [
    { id: "structure", name: "Semantics & structure" },
    { id: "forms", name: "Forms & validation" },
    { id: "accessibility", name: "Accessibility" },
    { id: "media", name: "Images & scripts" },
    { id: "interactive", name: "Native interactive elements" },
  ],
  snippets: webHtml,
};

/**
 * Modern JavaScript, checked by Prettier.
 *
 * Deliberately overlapping the TypeScript corpus as little as possible:
 * someone practising both should meet the parts that are genuinely
 * JavaScript's — the DOM, modules, iteration protocols — rather than the same
 * code twice with the annotations removed.
 */
export const javascript: SnippetSet = {
  syntax: "javascript_code",
  framework: "JavaScript",
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
    { id: "basics", name: "Language basics" },
    { id: "functions", name: "Functions & closures" },
    { id: "arrays", name: "Arrays" },
    { id: "objects", name: "Objects, maps & sets" },
    { id: "async", name: "Async, promises & generators" },
    { id: "errors", name: "Errors" },
    { id: "modules", name: "Modules" },
    { id: "dom", name: "The DOM" },
  ],
  snippets: webJavascript,
};
