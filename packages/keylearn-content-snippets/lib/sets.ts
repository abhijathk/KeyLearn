import { json, yaml } from "./snippets/config-ts.ts";
import { cpp } from "./snippets/cpp-set.ts";
import { cypress } from "./snippets/cypress-ts.ts";
import { go } from "./snippets/go-set.ts";
import { java } from "./snippets/java-set.ts";
import { kotlin, swift } from "./snippets/mobile-ts.ts";
import { php } from "./snippets/php-set.ts";
import { playwrightJs, playwrightTs } from "./snippets/playwright-ts.ts";
import { python } from "./snippets/python-ts.ts";
import { react } from "./snippets/react-ts.ts";
import { regex } from "./snippets/regex-set.ts";
import { rust } from "./snippets/rust-set.ts";
import { seleniumJv, seleniumPy } from "./snippets/selenium-ts.ts";
import { sqlPostgres, sqlServer } from "./snippets/sql-ts.ts";
import { csharp, shell } from "./snippets/systems-ts.ts";
import { typescript } from "./snippets/typescript-set.ts";
import { css, html, javascript } from "./snippets/web-ts.ts";
import { type SnippetSet } from "./types.ts";

/**
 * Every corpus we have, keyed by the `Syntax` id the practice settings use.
 *
 * A language appears here once its snippets are written and its formatter gate
 * passes; there is deliberately no placeholder for the ones that are not
 * written yet, so an empty menu entry can never appear.
 */
export const SNIPPET_SETS: readonly SnippetSet[] = [
  cpp,
  csharp,
  css,
  cypress,
  go,
  html,
  java,
  javascript,
  json,
  kotlin,
  php,
  playwrightTs,
  playwrightJs,
  python,
  react,
  regex,
  rust,
  seleniumPy,
  seleniumJv,
  shell,
  sqlPostgres,
  sqlServer,
  swift,
  typescript,
  yaml,
];
