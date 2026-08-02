import { JSON_C, YAML } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { configJson } from "./config-json.ts";
import { configYaml } from "./config-yaml.ts";

/**
 * JSON, formatted by Prettier.
 *
 * The dialect is JSON with comments — what the files people actually edit
 * are, `tsconfig.json` and `.vscode/settings.json` among them — and Prettier's
 * `json` parser reads those happily.
 *
 * Not its `jsonc` parser, which honours this repo's `trailingComma: "all"` and
 * would rewrite every snippet to end with a comma that strict JSON rejects.
 * One of these snippets warns against exactly that, so the gate would have
 * been enforcing the opposite of what the corpus teaches.
 */
export const json: SnippetSet = {
  syntax: "json",
  framework: "JSON",
  language: "JSON",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "json"],
    extension: ".json",
  },
  lineComment: ["//"],
  lexicon: JSON_C,
  topics: [
    { id: "syntax", name: "Syntax" },
    { id: "tooling", name: "Tool configs" },
    { id: "api", name: "API payloads" },
    { id: "schema", name: "Schemas" },
  ],
  snippets: configJson,
};

/**
 * YAML, formatted by Prettier.
 *
 * The one language here where indentation is not a matter of style — Prettier
 * will normalise a document, but it cannot rescue one whose meaning changed
 * because a key sat two spaces further in than intended. That is precisely why
 * it is worth typing.
 */
export const yaml: SnippetSet = {
  syntax: "yaml",
  framework: "YAML",
  language: "YAML",
  standard: "Prettier",
  formatter: {
    command: "prettier",
    args: ["--parser", "yaml"],
    extension: ".yaml",
  },
  lineComment: ["#"],
  lexicon: YAML,
  topics: [
    { id: "syntax", name: "Syntax" },
    { id: "ci", name: "CI pipelines" },
    { id: "docker", name: "Containers" },
    { id: "kubernetes", name: "Kubernetes" },
  ],
  snippets: configYaml,
};
