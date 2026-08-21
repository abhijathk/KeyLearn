import { readFile } from "node:fs/promises";

/**
 * Reserved words cannot be `const` names.
 *
 * A stylesheet is free to call a class `.switch` or `.default` — CSS has
 * no such list — and emitting `export const switch = "switch"` is a
 * syntax error that takes down not just that stylesheet but every test
 * that transitively imports it. Such names are skipped rather than
 * mangled: a test that reaches for `styles.switch` should fail on the
 * missing export, which is findable, rather than on a renamed one, which
 * is not.
 */
const RESERVED = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export async function importStyles(fileName: string): Promise<string> {
  const content = await readFile(fileName, "utf-8");
  const names = new Set<string>();
  for (const item of content.matchAll(/[.#]([a-z][-_a-z0-9]*)/gi)) {
    names.add(item[1]!);
  }
  return [...names]
    .map((name) => [toCamelCase(name), name] as const)
    .filter(([identifier]) => !RESERVED.has(identifier))
    .map(([identifier, name]) => `export const ${identifier} = "${name}";\n`)
    .join("");
}

function toCamelCase(name: string): string {
  return name
    .split("-")
    .map((word, index) => {
      if (index === 0) {
        return word;
      } else {
        return (
          word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase()
        );
      }
    })
    .join("");
}
