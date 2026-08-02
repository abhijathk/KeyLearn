import { type Snippet } from "../types.ts";

/**
 * JSON, as configuration files are actually written.
 *
 * JSONC rather than strict JSON — the dialect with comments, which is what
 * `tsconfig.json`, `.vscode/settings.json` and most tooling configs really
 * are. Strict JSON forbids comments, and a corpus of uncommented braces would
 * teach the punctuation and nothing else.
 *
 * Config is a large share of what anyone actually types, and it is unusually
 * punctuation-dense: braces, brackets, quotes and commas in every line.
 */
export const configJson: readonly Snippet[] = [
  {
    id: "json-object",
    title: "An object with the common value types",
    level: 1,
    tags: ["json", "syntax"],
    code: `// Keys are always quoted in JSON, unlike a JavaScript object literal.
{
  "name": "keylearn",
  "version": "1.4.0",
  "private": true,
  "workspaces": ["packages/*"]
}`,
  },
  {
    id: "json-nested",
    title: "Nested objects and arrays",
    level: 1,
    tags: ["json", "syntax"],
    code: `// No trailing comma after the last entry: strict JSON rejects it, and
// it is the single most common reason a config file fails to parse.
{
  "scripts": {
    "build": "webpack",
    "test": "node --test"
  },
  "keywords": ["typing", "practice", "braille"]
}`,
  },
  {
    id: "json-null",
    title: "Null, and the difference from absent",
    level: 2,
    tags: ["json", "syntax"],
    code: `// A key set to null and a key that is missing are different states, and
// most parsers hand them to you differently. Decide which you mean.
{
  "endDate": null,
  "startDate": "2026-01-01"
}`,
  },
  {
    id: "json-escapes",
    title: "Escaping inside a string",
    level: 3,
    tags: ["json", "syntax"],
    code: `// Only double quotes, and backslash escapes for the rest. A Windows
// path in JSON needs every separator doubled.
{
  "pattern": "^[A-Z]\\\\d{3}$",
  "path": "C:\\\\Users\\\\ada\\\\projects",
  "message": "She said \\"hello\\" and left."
}`,
  },
  {
    id: "json-tsconfig",
    title: "A TypeScript configuration",
    level: 3,
    tags: ["json", "tooling"],
    code: `// strict is one flag that turns on eight, and it is the one worth
// having: almost every other setting here is downstream of it.
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["lib/**/*"]
}`,
  },
  {
    id: "json-tsconfig-beyond-strict",
    title: "The checks strict does not turn on",
    level: 4,
    tags: ["json", "tooling"],
    code: `// noUncheckedIndexedAccess is the valuable one: it makes array[0] have
// type T | undefined, which is the truth, and which strict alone will not
// tell you.
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  }
}`,
  },
  {
    id: "json-tsconfig-modules",
    title: "Emit the imports exactly as written",
    level: 4,
    tags: ["json", "tooling"],
    code: `// verbatimModuleSyntax stops the compiler guessing which imports are
// types, which is what makes an explicit "import type" mandatory — and what
// makes the output predictable.
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  }
}`,
  },
  {
    id: "json-tsconfig-paths",
    title: "Import by name rather than by path",
    level: 4,
    tags: ["json", "tooling"],
    code: `// The bundler has to agree. A path only the compiler knows about
// resolves at build time and fails at run time, which is the worst order
// to find out in.
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@keybr/*": ["packages/keybr-*/lib/index.ts"]
    }
  }
}`,
  },
  {
    id: "json-package",
    title: "A package manifest",
    level: 2,
    tags: ["json", "tooling"],
    code: `// "type": "module" decides how every .js file in the package is parsed.
// Omitting it is why an import statement suddenly fails at runtime.
{
  "name": "@keybr/content-snippets",
  "version": "0.0.0",
  "type": "module",
  "main": "lib/index.ts",
  "scripts": {
    "test": "node --test"
  }
}`,
  },
  {
    id: "json-api-payload",
    title: "An API response",
    level: 2,
    tags: ["json", "api"],
    code: `// ISO-8601 with an offset, not a local timestamp: a date without a zone
// is ambiguous by exactly the amount that causes the bug.
{
  "id": 1042,
  "status": "confirmed",
  "createdAt": "2026-08-02T09:15:00+10:00",
  "items": [{ "sku": "KB-01", "quantity": 2 }]
}`,
  },
  {
    id: "json-error-shape",
    title: "An error response worth returning",
    level: 3,
    tags: ["json", "api"],
    code: `// A machine-readable code beside a human-readable message: the client
// branches on the first and shows the second.
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The order could not be created.",
    "fields": { "quantity": "must be greater than zero" }
  }
}`,
  },
  {
    id: "json-schema",
    title: "A JSON Schema",
    level: 4,
    tags: ["json", "schema"],
    code: `// additionalProperties false is what turns a schema from a suggestion
// into a contract: without it, a typo in a key passes validation.
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["sku", "quantity"],
  "additionalProperties": false,
  "properties": {
    "sku": { "type": "string", "pattern": "^[A-Z]{2}-\\\\d{2}$" },
    "quantity": { "type": "integer", "minimum": 1 }
  }
}`,
  },
  {
    id: "json-eslint",
    title: "A linter configuration",
    level: 3,
    tags: ["json", "tooling"],
    code: `// Rules are ordered by severity in most configs: what fails the build
// first, and what is only a warning.
{
  "extends": ["eslint:recommended"],
  "rules": {
    "eqeqeq": ["error", "smart"],
    "no-console": "warn",
    "prefer-const": "error"
  }
}`,
  },
];
